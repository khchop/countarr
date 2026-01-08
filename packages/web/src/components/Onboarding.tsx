import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  Server,
  Film,
  Tv,
  Subtitles,
  Search,
  MessageCircle,
  Play,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

// Static color classes to ensure Tailwind includes them in the build
const SERVICE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', border: 'border-yellow-500/30' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-500', border: 'border-blue-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-500', border: 'border-purple-500/30' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-500', border: 'border-orange-500/30' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-500', border: 'border-pink-500/30' },
  green: { bg: 'bg-green-500/20', text: 'text-green-500', border: 'border-green-500/30' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-500', border: 'border-cyan-500/30' },
};

const SERVICE_TYPES = [
  { type: 'radarr', label: 'Radarr', icon: Film, description: 'Movie management and downloads', color: 'yellow', defaultPort: 7878, multiInstance: true },
  { type: 'sonarr', label: 'Sonarr', icon: Tv, description: 'TV series management and downloads', color: 'blue', defaultPort: 8989, multiInstance: true },
  { type: 'bazarr', label: 'Bazarr', icon: Subtitles, description: 'Subtitle management', color: 'purple', defaultPort: 6767, multiInstance: true },
  { type: 'prowlarr', label: 'Prowlarr', icon: Search, description: 'Indexer management', color: 'orange', defaultPort: 9696, multiInstance: false },
  { type: 'jellyseerr', label: 'Jellyseerr', icon: MessageCircle, description: 'Request management', color: 'pink', defaultPort: 5055, multiInstance: false },
  { type: 'emby', label: 'Emby', icon: Play, description: 'Media playback tracking', color: 'green', defaultPort: 8096, multiInstance: false },
  { type: 'jellyfin', label: 'Jellyfin', icon: Play, description: 'Media playback tracking', color: 'cyan', defaultPort: 8096, multiInstance: false },
] as const;

interface ConnectionForm {
  type: string;
  name: string;
  url: string;
  apiKey: string;
}

interface AddedConnection {
  id: number;
  name: string;
  type: string;
}

export function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'welcome' | 'select' | 'configure'>('welcome');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionForm>({ type: '', name: '', url: '', apiKey: '' });
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [addedConnections, setAddedConnections] = useState<AddedConnection[]>([]);

  const testMutation = useMutation({
    mutationFn: (data: { type: string; url: string; apiKey: string }) => api.connections.testNew(data),
    onSuccess: (result) => setTestResult(result),
    onError: (err: Error) => setTestResult({ success: false, error: err.message }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: string; url: string; apiKey: string }) => api.connections.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setAddedConnections((prev) => [...prev, { id: result.id, name: result.name, type: result.type }]);
      setStep('select');
      setSelectedType(null);
      setForm({ type: '', name: '', url: '', apiKey: '' });
      setTestResult(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.connections.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setAddedConnections((prev) => prev.filter((c) => c.id !== deletedId));
    },
  });

  // Count how many instances of each type have been added
  const getInstanceCount = (type: string) => addedConnections.filter((c) => c.type === type).length;

  const handleSelectType = (type: string) => {
    const service = SERVICE_TYPES.find((s) => s.type === type);
    const instanceCount = getInstanceCount(type);
    
    // Suggest a name based on common use cases
    let suggestedName = service?.label ?? type;
    if (instanceCount > 0) {
      // Common naming patterns for multi-instance setups
      const suggestions = ['4K', 'HD', 'Anime', 'Kids', 'Foreign'];
      suggestedName = `${service?.label} ${suggestions[instanceCount - 1] || instanceCount + 1}`;
    }

    setSelectedType(type);
    setForm({
      type,
      name: suggestedName,
      url: `http://localhost:${service?.defaultPort ?? ''}`,
      apiKey: '',
    });
    setTestResult(null);
    setStep('configure');
  };

  const handleTest = () => {
    setTestResult(null);
    testMutation.mutate({ type: form.type, url: form.url, apiKey: form.apiKey });
  };

  const handleSave = () => {
    createMutation.mutate(form);
  };

  const handleRemoveConnection = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleFinish = () => {
    queryClient.invalidateQueries({ queryKey: ['connections'] });
    navigate('/');
  };

  const selectedService = SERVICE_TYPES.find((s) => s.type === selectedType);

  // Group added connections by type for display
  const connectionsByType = addedConnections.reduce((acc, conn) => {
    if (!acc[conn.type]) acc[conn.type] = [];
    acc[conn.type].push(conn);
    return acc;
  }, {} as Record<string, AddedConnection[]>);

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center space-y-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent-blue/20">
              <Server className="w-10 h-10 text-accent-blue" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-4">Welcome to Countarr</h1>
              <p className="text-lg text-text-muted max-w-lg mx-auto">
                Your personal statistics dashboard for Radarr, Sonarr, and other *arr applications.
                Let's connect your services to get started.
              </p>
            </div>
            <button
              onClick={() => setStep('select')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors"
            >
              Get Started
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Select Service Step */}
        {step === 'select' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {addedConnections.length > 0 ? 'Add More Services' : 'Connect Your Services'}
              </h2>
              <p className="text-text-muted">
                {addedConnections.length > 0 
                  ? 'Add another service or instance, or finish setup when ready.'
                  : 'Select a service to connect. You can add multiple instances of the same service.'}
              </p>
            </div>

            {/* Added Connections Summary */}
            {addedConnections.length > 0 && (
              <div className="bg-background-secondary border border-border rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-accent-green">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Connected Services ({addedConnections.length})</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(connectionsByType).map(([type, connections]) => {
                    const service = SERVICE_TYPES.find((s) => s.type === type);
                    const colors = SERVICE_COLORS[service?.color ?? 'blue'];
                    const Icon = service?.icon ?? Server;
                    return (
                      <div key={type} className="flex flex-wrap gap-2">
                        {connections.map((conn) => (
                          <div
                            key={conn.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg} ${colors.border} border`}
                          >
                            <Icon className={`w-4 h-4 ${colors.text}`} />
                            <span className="text-sm font-medium">{conn.name}</span>
                            <button
                              onClick={() => handleRemoveConnection(conn.id)}
                              disabled={deleteMutation.isPending}
                              className="ml-1 p-0.5 rounded hover:bg-background-tertiary transition-colors text-text-muted hover:text-accent-red"
                              title="Remove connection"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Service Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SERVICE_TYPES.map((service) => {
                const Icon = service.icon;
                const colors = SERVICE_COLORS[service.color];
                const instanceCount = getInstanceCount(service.type);
                const hasInstance = instanceCount > 0;
                
                return (
                  <button
                    key={service.type}
                    onClick={() => handleSelectType(service.type)}
                    className={`flex items-start gap-4 p-4 rounded-lg border text-left transition-all bg-background-secondary border-border hover:border-accent-blue hover:bg-background-tertiary`}
                  >
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-text-primary">{service.label}</h3>
                        {hasInstance && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                            {instanceCount} added
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-muted">{service.description}</p>
                      {service.multiInstance && (
                        <p className="text-xs text-text-dim mt-1 flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          Supports multiple instances
                        </p>
                      )}
                    </div>
                    <div className="self-center">
                      <Plus className={`w-5 h-5 ${hasInstance ? colors.text : 'text-text-muted'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Finish Button */}
            {addedConnections.length > 0 && (
              <div className="flex justify-center pt-6 border-t border-border mt-6">
                <button
                  onClick={handleFinish}
                  className="px-8 py-3 bg-accent-green text-white rounded-lg font-medium hover:bg-accent-green/90 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Finish Setup & Go to Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Configure Service Step */}
        {step === 'configure' && selectedService && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => {
                  setStep('select');
                  setSelectedType(null);
                  setTestResult(null);
                }}
                className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180 text-text-muted" />
              </button>
              <div className="flex items-center gap-3">
                {(() => {
                  const colors = SERVICE_COLORS[selectedService.color];
                  const Icon = selectedService.icon;
                  return (
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                  );
                })()}
                <div>
                  <h2 className="text-xl font-bold text-text-primary">
                    Add {selectedService.label}
                    {getInstanceCount(selectedService.type) > 0 && ' Instance'}
                  </h2>
                  <p className="text-sm text-text-muted">{selectedService.description}</p>
                </div>
              </div>
            </div>

            {/* Multi-instance hint */}
            {selectedService.multiInstance && getInstanceCount(selectedService.type) === 0 && (
              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3 text-sm text-accent-blue">
                <strong>Tip:</strong> If you have multiple {selectedService.label} instances (e.g., 4K and HD libraries), 
                you can add them all. Give each a descriptive name like "{selectedService.label} 4K" or "{selectedService.label} Anime".
              </div>
            )}

            <div className="bg-background-secondary rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  placeholder={`${selectedService.label} 4K`}
                />
                <p className="text-xs text-text-muted mt-1">
                  Use a descriptive name like "{selectedService.label} 4K" or "{selectedService.label} Anime"
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  placeholder={`http://localhost:${selectedService.defaultPort}`}
                />
                <p className="text-xs text-text-muted mt-1">
                  The full URL to your {selectedService.label} instance
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="w-full px-4 py-2 bg-background-tertiary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  placeholder="Your API key"
                />
                <p className="text-xs text-text-muted mt-1">
                  Found in {selectedService.label} Settings &rarr; General &rarr; API Key
                </p>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    testResult.success
                      ? 'bg-accent-green/10 text-accent-green'
                      : 'bg-accent-red/10 text-accent-red'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="text-sm">
                    {testResult.success ? 'Connection successful!' : testResult.error || 'Connection failed'}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleTest}
                  disabled={!form.url || !form.apiKey || testMutation.isPending}
                  className="flex-1 px-4 py-2 border border-border rounded-lg font-medium hover:bg-background-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </span>
                  ) : (
                    'Test Connection'
                  )}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!testResult?.success || createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save & Add More'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
