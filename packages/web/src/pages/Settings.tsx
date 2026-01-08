import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Plus,
  X,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react';
import { Panel } from '@/components/layout/Panel';
import { SyncStatus } from '@/components/SyncStatus';
import { api } from '@/api/client';

type ServiceType = 'radarr' | 'sonarr' | 'bazarr' | 'prowlarr' | 'jellyseerr' | 'emby' | 'jellyfin';

const SERVICE_INFO: Record<ServiceType, { name: string; color: string; defaultPort: number }> = {
  radarr: { name: 'Radarr', color: '#ffc107', defaultPort: 7878 },
  sonarr: { name: 'Sonarr', color: '#3498db', defaultPort: 8989 },
  bazarr: { name: 'Bazarr', color: '#9b59b6', defaultPort: 6767 },
  prowlarr: { name: 'Prowlarr', color: '#e74c3c', defaultPort: 9696 },
  jellyseerr: { name: 'Jellyseerr', color: '#8e44ad', defaultPort: 5055 },
  emby: { name: 'Emby', color: '#52b54b', defaultPort: 8096 },
  jellyfin: { name: 'Jellyfin', color: '#00a4dc', defaultPort: 8096 },
};

interface ConnectionFormData {
  name: string;
  type: ServiceType;
  url: string;
  apiKey: string;
  enabled: boolean;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<number, boolean>>({});
  const [testingId, setTestingId] = useState<number | null>(null);
  const [newGroup, setNewGroup] = useState('');

  const { data: connections, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.connections.list(),
  });

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
  });

  const createMutation = useMutation({
    mutationFn: api.connections.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setShowAddForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.connections.update>[1] }) =>
      api.connections.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.connections.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: api.connections.test,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onSettled: () => {
      setTestingId(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (type: 'full' | 'history' | 'metadata' | 'playback') => api.settings.sync(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    testMutation.mutate(id);
  };

  const handleAddFavoriteGroup = () => {
    if (!newGroup.trim()) return;
    const current = settings?.favoriteReleaseGroups ?? [];
    if (!current.includes(newGroup.trim())) {
      updateSettingsMutation.mutate({
        favoriteReleaseGroups: [...current, newGroup.trim()],
      });
    }
    setNewGroup('');
  };

  const handleRemoveFavoriteGroup = (group: string) => {
    const current = settings?.favoriteReleaseGroups ?? [];
    updateSettingsMutation.mutate({
      favoriteReleaseGroups: current.filter(g => g !== group),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Service Connections */}
      <Panel title="Service Connections" subtitle="Configure your *arr applications and media servers">
        <div className="space-y-4">
          {loadingConnections ? (
            <div className="h-32 skeleton rounded" />
          ) : (
            <>
              {connections && connections.length > 0 ? (
                <div className="space-y-3">
                  {connections.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      isEditing={editingId === conn.id}
                      isTesting={testingId === conn.id}
                      showApiKey={showApiKey[conn.id]}
                      onEdit={() => setEditingId(conn.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={(data) => updateMutation.mutate({ id: conn.id, data })}
                      onDelete={() => deleteMutation.mutate(conn.id)}
                      onTest={() => handleTestConnection(conn.id)}
                      onToggleApiKey={() =>
                        setShowApiKey(prev => ({ ...prev, [conn.id]: !prev[conn.id] }))
                      }
                      onToggleEnabled={(enabled) =>
                        updateMutation.mutate({ id: conn.id, data: { enabled } })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-text-muted">
                  <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No services configured yet.</p>
                  <p className="text-sm mt-1">Add your first service to start collecting stats.</p>
                </div>
              )}

              {showAddForm ? (
                <AddConnectionForm
                  onSave={(data) => createMutation.mutate(data)}
                  onCancel={() => setShowAddForm(false)}
                  isLoading={createMutation.isPending}
                  error={createMutation.error?.message}
                />
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-3 border-2 border-dashed border-border rounded-lg text-text-muted hover:text-text hover:border-accent-blue transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Service Connection
                </button>
              )}
            </>
          )}
        </div>
      </Panel>

      {/* Sync Status & Controls */}
      <Panel title="Data Synchronization" subtitle="Monitor sync progress and trigger manual syncs">
        <SyncStatus
          onTriggerSync={(type) => syncMutation.mutate(type)}
          isSyncPending={syncMutation.isPending}
        />
      </Panel>

      {/* Polling Intervals */}
      <Panel title="Polling Intervals" subtitle="How often data is automatically synced (in minutes)">
        {loadingSettings ? (
          <div className="h-24 skeleton rounded" />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-background rounded-lg">
              <p className="text-text-muted text-sm mb-2">History</p>
              <input
                type="number"
                value={settings?.pollIntervals.history ?? 5}
                onChange={(e) =>
                  updateSettingsMutation.mutate({ pollIntervalHistory: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-xl font-semibold focus:outline-none focus:border-accent-blue"
                min={1}
                max={60}
              />
            </div>
            <div className="p-4 bg-background rounded-lg">
              <p className="text-text-muted text-sm mb-2">Metadata</p>
              <input
                type="number"
                value={settings?.pollIntervals.metadata ?? 30}
                onChange={(e) =>
                  updateSettingsMutation.mutate({ pollIntervalMetadata: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-xl font-semibold focus:outline-none focus:border-accent-blue"
                min={1}
                max={120}
              />
            </div>
            <div className="p-4 bg-background rounded-lg">
              <p className="text-text-muted text-sm mb-2">Playback</p>
              <input
                type="number"
                value={settings?.pollIntervals.playback ?? 1}
                onChange={(e) =>
                  updateSettingsMutation.mutate({ pollIntervalPlayback: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-xl font-semibold focus:outline-none focus:border-accent-blue"
                min={1}
                max={30}
              />
            </div>
          </div>
        )}
      </Panel>

      {/* Favorite Release Groups */}
      <Panel title="Favorite Release Groups" subtitle="Track downloads from your preferred groups">
        {loadingSettings ? (
          <div className="h-24 skeleton rounded" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(settings?.favoriteReleaseGroups ?? []).map((group) => (
                <span
                  key={group}
                  className="flex items-center gap-2 px-3 py-1.5 bg-accent-purple/20 text-accent-purple rounded-lg"
                >
                  {group}
                  <button
                    onClick={() => handleRemoveFavoriteGroup(group)}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
              {(settings?.favoriteReleaseGroups?.length ?? 0) === 0 && (
                <p className="text-text-muted">No favorite groups configured</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFavoriteGroup()}
                placeholder="Add release group..."
                className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-accent-blue"
              />
              <button
                onClick={handleAddFavoriteGroup}
                disabled={!newGroup.trim()}
                className="px-4 py-2 bg-accent-purple text-white rounded-lg hover:bg-accent-purple/80 transition-colors disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* About */}
      <Panel title="About Countarr">
        <div className="space-y-2 text-text-muted">
          <p>Version: 1.0.0</p>
          <p>
            Media server statistics dashboard for Radarr, Sonarr, Bazarr, Prowlarr, Jellyseerr, and
            Emby/Jellyfin.
          </p>
        </div>
      </Panel>
    </div>
  );
}

// Connection Card Component
interface ConnectionCardProps {
  connection: {
    id: number;
    name: string;
    type: string;
    url: string;
    apiKey: string;
    enabled: boolean;
    lastTestSuccess: boolean | null;
    lastTestError: string | null;
  };
  isEditing: boolean;
  isTesting: boolean;
  showApiKey: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: { name?: string; url?: string; apiKey?: string }) => void;
  onDelete: () => void;
  onTest: () => void;
  onToggleApiKey: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

function ConnectionCard({
  connection,
  isEditing,
  isTesting,
  showApiKey,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onTest,
  onToggleApiKey,
  onToggleEnabled,
}: ConnectionCardProps) {
  const [formData, setFormData] = useState({
    name: connection.name,
    url: connection.url,
    apiKey: '',
  });

  const serviceInfo = SERVICE_INFO[connection.type as ServiceType];

  if (isEditing) {
    return (
      <div className="p-4 bg-background rounded-lg border border-accent-blue">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-text-muted">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 mt-1 bg-background-secondary border border-border rounded-lg focus:outline-none focus:border-accent-blue"
            />
          </div>
          <div>
            <label className="text-sm text-text-muted">URL</label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 mt-1 bg-background-secondary border border-border rounded-lg focus:outline-none focus:border-accent-blue"
            />
          </div>
          <div>
            <label className="text-sm text-text-muted">API Key (leave blank to keep existing)</label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter new API key..."
              className="w-full px-3 py-2 mt-1 bg-background-secondary border border-border rounded-lg focus:outline-none focus:border-accent-blue"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSave({
                name: formData.name !== connection.name ? formData.name : undefined,
                url: formData.url !== connection.url ? formData.url : undefined,
                apiKey: formData.apiKey || undefined,
              })}
              className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-4 py-2 bg-background-tertiary rounded-lg hover:bg-border"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-background rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: serviceInfo?.color ?? '#888' }}
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{connection.name}</p>
              <span className="px-2 py-0.5 text-xs rounded bg-background-tertiary text-text-muted">
                {serviceInfo?.name ?? connection.type}
              </span>
            </div>
            <p className="text-sm text-text-muted">{connection.url}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          {connection.lastTestSuccess !== null && (
            <div className="flex items-center gap-1">
              {connection.lastTestSuccess ? (
                <CheckCircle className="w-5 h-5 text-accent-green" />
              ) : (
                <span title={connection.lastTestError ?? ''}>
                  <XCircle className="w-5 h-5 text-accent-red" />
                </span>
              )}
            </div>
          )}

          {/* Enable/Disable Toggle */}
          <button
            onClick={() => onToggleEnabled(!connection.enabled)}
            className={`px-3 py-1 rounded-full text-sm ${
              connection.enabled
                ? 'bg-accent-green/20 text-accent-green'
                : 'bg-background-tertiary text-text-muted'
            }`}
          >
            {connection.enabled ? 'Enabled' : 'Disabled'}
          </button>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onTest}
              disabled={isTesting}
              className="p-2 text-text-muted hover:text-text hover:bg-background-tertiary rounded-lg transition-colors"
              title="Test connection"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onToggleApiKey}
              className="p-2 text-text-muted hover:text-text hover:bg-background-tertiary rounded-lg transition-colors"
              title={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-text-muted hover:text-text hover:bg-background-tertiary rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-text-muted hover:text-accent-red hover:bg-background-tertiary rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Show API Key */}
      {showApiKey && (
        <div className="mt-3 p-2 bg-background-secondary rounded text-sm font-mono text-text-muted">
          {connection.apiKey}
        </div>
      )}

      {/* Error Message */}
      {connection.lastTestError && (
        <p className="mt-2 text-sm text-accent-red">{connection.lastTestError}</p>
      )}
    </div>
  );
}

// Add Connection Form Component
interface AddConnectionFormProps {
  onSave: (data: ConnectionFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}

function AddConnectionForm({ onSave, onCancel, isLoading, error }: AddConnectionFormProps) {
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    type: 'radarr',
    url: '',
    apiKey: '',
    enabled: true,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; version?: string } | null>(null);

  const handleTypeChange = (type: ServiceType) => {
    const info = SERVICE_INFO[type];
    setFormData(prev => ({
      ...prev,
      type,
      name: prev.name || info.name,
      url: prev.url || `http://localhost:${info.defaultPort}`,
    }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.connections.testNew({
        type: formData.type,
        url: formData.url,
        apiKey: formData.apiKey,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    }
    setTesting(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.url || !formData.apiKey) return;
    onSave(formData);
  };

  return (
    <div className="p-4 bg-background rounded-lg border border-accent-blue">
      <h3 className="font-medium mb-4">Add New Service</h3>

      <div className="space-y-4">
        {/* Service Type */}
        <div>
          <label className="text-sm text-text-muted">Service Type</label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {(Object.keys(SERVICE_INFO) as ServiceType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.type === type
                    ? 'text-white'
                    : 'bg-background-secondary text-text-muted hover:text-text'
                }`}
                style={{
                  backgroundColor: formData.type === type ? SERVICE_INFO[type].color : undefined,
                }}
              >
                {SERVICE_INFO[type].name}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm text-text-muted">Display Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={SERVICE_INFO[formData.type].name}
            className="w-full px-3 py-2 mt-1 bg-background-secondary border border-border rounded-lg focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-sm text-text-muted">URL</label>
          <input
            type="text"
            value={formData.url}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, url: e.target.value }));
              setTestResult(null);
            }}
            placeholder={`http://localhost:${SERVICE_INFO[formData.type].defaultPort}`}
            className="w-full px-3 py-2 mt-1 bg-background-secondary border border-border rounded-lg focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="text-sm text-text-muted">API Key</label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, apiKey: e.target.value }));
              setTestResult(null);
            }}
            placeholder="Enter API key..."
            className="w-full px-3 py-2 mt-1 bg-background-secondary border border-border rounded-lg focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-3 rounded-lg ${
              testResult.success ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
            }`}
          >
            {testResult.success ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>Connection successful! {testResult.version && `(v${testResult.version})`}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                <span>{testResult.error || 'Connection failed'}</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-accent-red/20 text-accent-red">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !formData.url || !formData.apiKey}
            className="px-4 py-2 bg-background-tertiary rounded-lg hover:bg-border transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Test Connection
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !formData.name || !formData.url || !formData.apiKey}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Service
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-background-tertiary rounded-lg hover:bg-border transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
