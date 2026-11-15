import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, UserCheck } from 'lucide-react';
import type { SpeakerConfig, SystemStateResponse } from '../types';

interface AccessSsoTabProps {
  state: SystemStateResponse;
  isAdmin: boolean;
  onUpdateConfig: (patch: Partial<SpeakerConfig>) => void;
  onLoginAs: (provider: 'ldap' | 'entra' | 'local', username: string, group?: string) => void;
  onTestDirectory: (provider: 'ldap' | 'entra') => Promise<{ ok: boolean; message: string }>;
}

export const AccessSsoTab: React.FC<AccessSsoTabProps> = ({
  state,
  isAdmin,
  onUpdateConfig,
  onLoginAs,
  onTestDirectory,
}) => {
  const { config, session } = state;
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async (provider: 'ldap' | 'entra') => {
    setTestResult('Checking directory handshake...');
    const res = await onTestDirectory(provider);
    setTestResult(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Active Session & RBAC Verification */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Single Sign-On Session & Administrative Group Enforcement
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Signed in as {session.userDisplay} ({session.emailOrUpn}) · Provider {session.provider.toUpperCase()} · Matched Group{' '}
              <span className="font-mono text-slate-700">{session.matchedGroup}</span>
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded border ${
              session.role === 'admin'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {session.role === 'admin' ? 'Admin Access Granted' : 'Read-Only Operator'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-slate-600 mr-1">Verify SSO Group Mapping:</span>
          <button
            type="button"
            onClick={() =>
              onLoginAs('ldap', 'M. Vance', config.auth.ldapAdminGroupDn)
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Sign in: LDAP Admin Group</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onLoginAs('ldap', 'J. Mercer', config.auth.ldapOperatorGroupDn)
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Sign in: LDAP Read-Only</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onLoginAs('entra', 'E. Chen', config.auth.entraAdminGroupId)
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Sign in: Entra Admin Group</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onLoginAs('entra', 'S. Patel', config.auth.entraOperatorGroupId)
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Sign in: Entra Read-Only</span>
          </button>
        </div>

        {testResult && (
          <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{testResult}</span>
          </div>
        )}
      </section>

      {/* LDAP & Entra Configuration Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LDAP */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                LDAP / Active Directory SSO
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bind & group membership check via configurable Admin Group DN.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.auth.ldapEnabled}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, ldapEnabled: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 block mb-1">LDAP Server URI</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.auth.ldapUrl}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, ldapUrl: e.target.value },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Service Bind DN</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.auth.ldapBindDn}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, ldapBindDn: e.target.value },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 block mb-1">User Search Base DN</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={config.auth.ldapBaseDn}
                  onChange={(e) =>
                    onUpdateConfig({
                      auth: { ...config.auth, ldapBaseDn: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">User Search Filter</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={config.auth.ldapUserFilter}
                  onChange={(e) =>
                    onUpdateConfig({
                      auth: { ...config.auth, ldapUserFilter: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">
                Administrative Access Control LDAP Group DN
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.auth.ldapAdminGroupDn}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, ldapAdminGroupDn: e.target.value },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-blue-50/30"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Read-Only Operator Group DN</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.auth.ldapOperatorGroupDn}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, ldapOperatorGroupDn: e.target.value },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div className="pt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.auth.ldapUseStartTls}
                  onChange={(e) =>
                    onUpdateConfig({
                      auth: { ...config.auth, ldapUseStartTls: e.target.checked },
                    })
                  }
                  className="accent-blue-600 h-4 w-4"
                />
                <span>Require LDAPS / StartTLS certificate validation</span>
              </label>
              <button
                type="button"
                onClick={() => handleTest('ldap')}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-slate-50 text-slate-800 hover:bg-slate-100 whitespace-nowrap"
              >
                Test LDAP Bind
              </button>
            </div>
          </div>
        </section>

        {/* Microsoft Entra ID */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Microsoft Entra ID (OIDC SSO)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                OAuth 2.0 / OIDC sign-in with Entra Security Group Object ID claims.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.auth.entraEnabled}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, entraEnabled: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 block mb-1">Entra Tenant ID</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={config.auth.entraTenantId}
                  onChange={(e) =>
                    onUpdateConfig({
                      auth: { ...config.auth, entraTenantId: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">Application (Client) ID</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={config.auth.entraClientId}
                  onChange={(e) =>
                    onUpdateConfig({
                      auth: { ...config.auth, entraClientId: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-600 block mb-1">OIDC Redirect URI</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.auth.entraRedirectUri}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, entraRedirectUri: e.target.value },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-700 font-medium block mb-1">
                Admin Security Group Object ID
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.auth.entraAdminGroupId}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, entraAdminGroupId: e.target.value },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-blue-50/30"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Operator Group Object ID</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.auth.entraOperatorGroupId}
                onChange={(e) =>
                  onUpdateConfig({
                    auth: { ...config.auth, entraOperatorGroupId: e.target.value },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div className="pt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.auth.localBreakGlassEnabled}
                  onChange={(e) =>
                    onUpdateConfig({
                      auth: {
                        ...config.auth,
                        localBreakGlassEnabled: e.target.checked,
                      },
                    })
                  }
                  className="accent-blue-600 h-4 w-4"
                />
                <span>Allow local emergency break-glass login</span>
              </label>
              <button
                type="button"
                onClick={() => handleTest('entra')}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-slate-50 text-slate-800 hover:bg-slate-100 whitespace-nowrap"
              >
                Verify Entra OIDC
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
