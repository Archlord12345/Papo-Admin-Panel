import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { authService, dataService, type KycDocument, type User } from './lib/supabase';
import { PostsPanel } from './components/PostsPanel';

type View = 'dashboard' | 'users' | 'kyc' | 'posts';
type DashboardStats = Awaited<ReturnType<typeof dataService.getDashboardStats>>;

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });
const initialStats: DashboardStats = { totalUsers: 0, activeUsers: 0, totalWallets: 0, totalBalance: 0, totalTransactions: 0, transactionVolume: 0 };

function App() {
  const [admin, setAdmin] = useState<User | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [users, setUsers] = useState<User[]>([]);
  const [kyc, setKyc] = useState<KycDocument[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const pageSize = 15;

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setMessage('');
    try {
      const [dashboard, userResult, pendingDocuments] = await Promise.all([
        dataService.getDashboardStats(),
        dataService.getUsers(page, pageSize, search, '', status),
        dataService.getPendingKyc(),
      ]);
      setStats(dashboard);
      setUsers(userResult.users);
      setTotal(userResult.total);
      setKyc(pendingDocuments);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Les données administratives sont indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [admin, page, search, status]);

  useEffect(() => {
    authService.checkSession().then(setAdmin).catch(() => setAdmin(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const result = await authService.loginAdmin(phone, password);
    setLoading(false);
    if (!result.success || !result.user) {
      setMessage(result.error ?? 'Connexion refusée.');
      return;
    }
    setAdmin(result.user);
  };

  const changeAccountStatus = async (user: User) => {
    const nextStatus: User['status'] = user.isActive ? 'SUSPENDED' : 'ACTIVE';
    const action = user.isActive ? 'suspendre' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} le compte de ${user.name || user.phone} ?`)) return;
    setWorkingId(user.id);
    try {
      await dataService.setProfileStatus(user.id, nextStatus, `Action web administrateur : ${action}`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mise à jour impossible.');
    } finally {
      setWorkingId(null);
    }
  };

  const decideKyc = async (document: KycDocument, decision: 'approved' | 'rejected') => {
    const action = decision === 'approved' ? 'approuver' : 'rejeter';
    if (!window.confirm(`Voulez-vous ${action} ce dossier KYC ?`)) return;
    setWorkingId(document.id);
    try {
      await dataService.updateKycStatus(document.id, decision, 'Revue effectuée depuis le panneau web');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Décision KYC impossible.');
    } finally {
      setWorkingId(null);
    }
  };

  const title = useMemo(() => ({ dashboard: 'Vue d’ensemble', users: 'Comptes utilisateurs', kyc: 'Dossiers KYC', posts: 'Publications' }[view]), [view]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (!admin) {
    return (
      <main className="min-h-screen bg-slate-950 p-5 flex items-center justify-center">
        <section className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-slate-900 p-7 shadow-2xl">
          <div className="mb-7 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-slate-950"><WalletCards className="h-6 w-6" /></span><div><p className="text-xs font-bold tracking-[.2em] text-brand">PAPO</p><h1 className="text-xl font-black text-white">Administration sécurisée</h1></div></div>
          <p className="mb-6 text-sm leading-6 text-slate-400">L’accès est réservé aux rôles administratifs Supabase. Les opérations sensibles sont exécutées via des procédures contrôlées et auditées.</p>
          <form onSubmit={(event) => void login(event)} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-200">Téléphone administrateur<input required className="input mt-2" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+237690000000" autoComplete="tel" /></label>
            <label className="block text-sm font-semibold text-slate-200">Mot de passe Supabase<input required className="input mt-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
            {message && <p role="alert" className="rounded-xl border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{message}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
          </form>
        </section>
      </main>
    );
  }

  const navigation: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Synthèse', icon: LayoutDashboard },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'kyc', label: 'KYC', icon: ClipboardCheck },
    { id: 'posts', label: 'Publications', icon: ClipboardCheck },
  ];
  const cards = [
    ['Utilisateurs', stats.totalUsers.toLocaleString('fr-FR'), Users],
    ['Comptes actifs', stats.activeUsers.toLocaleString('fr-FR'), CheckCircle2],
    ['Portefeuilles', stats.totalWallets.toLocaleString('fr-FR'), WalletCards],
    ['Encours', money.format(stats.totalBalance), ShieldCheck],
    ['Transactions', stats.totalTransactions.toLocaleString('fr-FR'), Activity],
    ['Volume synchronisé', money.format(stats.transactionVolume), Activity],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-slate-950"><WalletCards className="h-5 w-5" /></span><div><p className="text-xs font-bold tracking-[.18em] text-brand">PAPO</p><p className="font-black">Administration</p></div></div><div className="flex items-center gap-3"><span className="hidden text-right text-sm sm:block"><b>{admin.name || admin.phone}</b><br /><small className="text-slate-500">Rôle administratif actif</small></span><button className="btn btn-secondary p-2" onClick={() => void load()} disabled={loading} title="Actualiser"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button className="btn btn-secondary p-2" onClick={() => void authService.logout().then(() => setAdmin(null))} title="Se déconnecter"><LogOut className="h-4 w-4" /></button></div></div></header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 lg:flex-row"><nav className="flex shrink-0 gap-2 overflow-auto lg:w-52 lg:flex-col" aria-label="Navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`btn justify-start whitespace-nowrap ${view === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView(id)}><Icon className="h-4 w-4" />{label}</button>)}</nav><main className="min-w-0 flex-1 space-y-6"><section className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-brand">Opérations sécurisées</p><h1 className="text-3xl font-black">{title}</h1></div><p className="max-w-lg text-sm leading-6 text-slate-500">Les mutations de comptes et les décisions KYC sont soumises à un contrôle de rôle et inscrites dans le journal d’audit.</p></section>{message && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p>}
        {view === 'dashboard' && <section className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, Icon]) => <article key={label} className="card p-5"><div className="mb-3 flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><span className="rounded-xl bg-violet-100 p-2 text-violet-700"><Icon className="h-4 w-4" /></span></div><p className="text-2xl font-black">{value}</p></article>)}</div><article className="card p-5"><h2 className="font-bold">Revue KYC</h2><p className="mt-2 text-sm text-slate-500">{kyc.length ? `${kyc.length} dossier(s) exigent une décision.` : 'Aucun dossier en attente actuellement.'}</p></article></section>}
        {view === 'users' && <section className="space-y-4"><form className="card flex flex-col gap-3 p-4 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(); }}><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, téléphone ou e-mail" /></div><select className="input sm:w-44" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tous statuts</option><option value="ACTIVE">Actifs</option><option value="SUSPENDED">Suspendus</option><option value="BANNED">Bannis</option></select><button className="btn btn-primary" type="submit">Filtrer</button></form><section className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Utilisateur</th><th className="px-5 py-3">Téléphone</th><th className="px-5 py-3">Solde</th><th className="px-5 py-3">KYC</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{loading ? <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>Chargement…</td></tr> : users.length === 0 ? <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>Aucun compte trouvé.</td></tr> : users.map((user) => <tr key={user.id} className="border-b border-slate-100"><td className="px-5 py-3"><b>{user.name || 'Sans nom'}</b><br /><small className="text-slate-500">{user.role}</small></td><td className="px-5 py-3 font-mono text-xs">{user.phone}</td><td className="px-5 py-3 font-semibold">{Number(user.walletBalance ?? 0).toLocaleString('fr-FR')} {user.walletCurrency ?? 'XAF'}</td><td className="px-5 py-3"><span className={`badge ${user.kycStatus === 'approved' ? 'badge-success' : 'badge-warning'}`}>{user.kycStatus === 'approved' ? 'Vérifié' : 'Basique'}</span></td><td className="px-5 py-3"><span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>{user.status}</span></td><td className="px-5 py-3 text-right"><button className={`btn p-2 ${user.isActive ? 'btn-danger' : 'btn-secondary'}`} disabled={workingId === user.id} onClick={() => void changeAccountStatus(user)} title={user.isActive ? 'Suspendre' : 'Réactiver'}>{user.isActive ? <LockKeyhole className="h-4 w-4" /> : <UnlockKeyhole className="h-4 w-4" />}</button></td></tr>)}</tbody></table></div><p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">{total} compte(s) · page {page}/{pages}</p></section></section>}
        {view === 'posts' && <PostsPanel />}
        {view === 'kyc' && <section className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Dossier</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Créé le</th><th className="px-5 py-3 text-right">Décision</th></tr></thead><tbody>{loading ? <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={4}>Chargement…</td></tr> : kyc.length === 0 ? <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={4}>Aucun dossier en attente.</td></tr> : kyc.map((document) => <tr key={document.id} className="border-b border-slate-100"><td className="px-5 py-3 font-mono text-xs">{document.id.slice(0, 8)}…</td><td className="px-5 py-3">{document.documentType}</td><td className="px-5 py-3">{new Date(document.createdAt).toLocaleString('fr-FR')}</td><td className="px-5 py-3"><div className="flex justify-end gap-2"><button className="btn btn-secondary p-2 text-red-600" disabled={workingId === document.id} onClick={() => void decideKyc(document, 'rejected')}><XCircle className="h-4 w-4" /></button><button className="btn btn-primary p-2" disabled={workingId === document.id} onClick={() => void decideKyc(document, 'approved')}><CheckCircle2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div></section>}
      </main></div>
    </div>
  );
}

export default App;
