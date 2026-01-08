export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// HTTP status codes that should trigger a retry
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Error messages that indicate network issues worth retrying
const RETRYABLE_ERRORS = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'fetch failed'];

export class BaseApiClient {
  protected baseUrl: string;
  protected apiKey: string;
  protected timeout: number;
  protected maxRetries: number;
  protected retryDelay: number;
  protected basicAuth: string | null;

  constructor(config: ApiClientConfig) {
    // Parse URL to extract any embedded credentials
    const { url, auth } = this.parseUrlCredentials(config.baseUrl);
    
    // Debug logging
    console.log('[BaseApiClient] Original URL:', config.baseUrl);
    console.log('[BaseApiClient] Cleaned URL:', url);
    console.log('[BaseApiClient] Has credentials:', !!auth);
    
    // Remove trailing slash
    this.baseUrl = url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.basicAuth = auth;
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  /**
   * Parse URL and extract any embedded credentials (user:pass@host format)
   * Returns the clean URL and base64-encoded auth header value
   */
  private parseUrlCredentials(inputUrl: string): { url: string; auth: string | null } {
    try {
      const parsed = new URL(inputUrl);
      
      if (parsed.username || parsed.password) {
        // Extract credentials
        const credentials = `${parsed.username}:${parsed.password}`;
        const auth = Buffer.from(credentials).toString('base64');
        
        // Remove credentials from URL
        parsed.username = '';
        parsed.password = '';
        
        return { url: parsed.toString(), auth };
      }
      
      return { url: inputUrl, auth: null };
    } catch {
      // If URL parsing fails, return as-is
      return { url: inputUrl, auth: null };
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private getRetryDelay(attempt: number): number {
    const exponentialDelay = this.retryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(status: number, error?: string): boolean {
    if (RETRYABLE_STATUS_CODES.includes(status)) {
      return true;
    }
    if (error && RETRYABLE_ERRORS.some(e => error.includes(e))) {
      return true;
    }
    return false;
  }

  /**
   * Parse Retry-After header (for rate limiting)
   */
  private parseRetryAfter(response: Response): number | null {
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) return null;

    // Try to parse as number of seconds
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try to parse as HTTP date
    const date = Date.parse(retryAfter);
    if (!isNaN(date)) {
      return Math.max(0, date - Date.now());
    }

    return null;
  }

  protected async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    
    // Debug logging
    console.log('[BaseApiClient] Making request to:', url);
    console.log('[BaseApiClient] Has basic auth:', !!this.basicAuth);
    
    let lastError: string = 'Unknown error';
    let lastStatus = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const headers = new Headers(options.headers);
        headers.set('Accept', 'application/json');
        
        // Add API key - most *arr apps use X-Api-Key header
        headers.set('X-Api-Key', this.apiKey);
        
        // Add Basic Auth if URL contained embedded credentials
        if (this.basicAuth) {
          headers.set('Authorization', `Basic ${this.basicAuth}`);
        }

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = this.parseRetryAfter(response) ?? this.getRetryDelay(attempt);
          if (attempt < this.maxRetries) {
            console.warn(`[API] Rate limited, retrying after ${retryAfter}ms`);
            await this.sleep(retryAfter);
            continue;
          }
          return {
            data: null,
            error: 'Rate limit exceeded',
            status: 429,
          };
        }

        // Handle authentication errors (don't retry)
        if (response.status === 401 || response.status === 403) {
          return {
            data: null,
            error: response.status === 401 ? 'Unauthorized - check API key' : 'Forbidden - access denied',
            status: response.status,
          };
        }

        // Handle other errors
        if (!response.ok) {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
          lastStatus = response.status;

          if (this.isRetryable(response.status) && attempt < this.maxRetries) {
            const delay = this.getRetryDelay(attempt);
            console.warn(`[API] Request failed (${response.status}), retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }

          return { data: null, error: lastError, status: lastStatus };
        }

        // Parse JSON safely
        const text = await response.text();
        if (!text) {
          return { data: null as T, error: null, status: response.status };
        }

        try {
          const data = JSON.parse(text) as T;
          return { data, error: null, status: response.status };
        } catch (parseError) {
          return {
            data: null,
            error: 'Invalid JSON response',
            status: response.status,
          };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            lastError = 'Request timeout';
          } else {
            lastError = err.message;
          }
        }
        lastStatus = 0;

        // Retry on network errors
        if (this.isRetryable(0, lastError) && attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          console.warn(`[API] Network error (${lastError}), retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
      }
    }
    
    return { data: null, error: lastError, status: lastStatus };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected async get<T>(path: string, params?: Record<string, string | number>): Promise<ApiResponse<T>> {
    let url = path;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, String(value));
      }
      url = `${path}?${searchParams.toString()}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    // Override in subclasses with appropriate health check endpoint
    return { success: false, error: 'Not implemented' };
  }
}
