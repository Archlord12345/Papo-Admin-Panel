import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Les variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont requises.');
}

/**
 * Client navigateur à privilèges minimaux. La service_role ne doit jamais être
 * présente dans Vite : les mutations sensibles passent exclusivement par RPC.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});

export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'KYC_AGENT';
export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  countryCode?: string;
  role: string;
  isAdmin: boolean;
  isActive: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  kycStatus: 'pending' | 'approved' | 'rejected' | 'none';
  avatarUrl?: string;
  walletBalance?: number;
  walletCurrency?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Wallet { id: string; userId: string; walletId: string; name: string; type: 'main' | 'savings' | 'merchant'; balance: number; currency: string; isActive: boolean; createdAt: string; updatedAt: string; }
export interface Transaction { id: string; reference: string; fromWalletId: string; toWalletId: string; amount: number; fee: number; type: string; status: 'pending' | 'completed' | 'failed' | 'cancelled'; description?: string; metadata?: Record<string, unknown>; createdAt: string; completedAt?: string; }
export interface KycDocument { id: string; userId: string; documentType: string; filePath: string; status: 'pending' | 'approved' | 'rejected'; verifiedAt?: string; rejectionReason?: string; createdAt: string; }
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface Post { id: string; authorId: string; authorName: string; title: string; body: string; imageUrl?: string; status: PostStatus; publishedAt?: string; createdAt: string; updatedAt: string; }
export interface ExternalOperator { id: string; code: string; name: string; countryCode: string; type: 'mobile_money' | 'bank' | 'crypto'; logoUrl?: string; isActive: boolean; depositEnabled: boolean; withdrawEnabled: boolean; minDeposit: number; maxDeposit: number; minWithdraw: number; maxWithdraw: number; }

const toNumber = (value: unknown) => Number(value ?? 0);
const profileToUser = (profile: Record<string, unknown>, roles: AdminRole[] = []): User => ({
  id: String(profile.id ?? profile.profile_id), name: String(profile.full_name ?? ''), phone: String(profile.phone ?? ''),
  email: profile.email ? String(profile.email) : undefined, countryCode: profile.country_code ? String(profile.country_code) : undefined,
  role: String(profile.role ?? profile.profile_role ?? 'CLIENT'),
  isAdmin: roles.length > 0, isActive: String(profile.status ?? profile.account_status ?? 'ACTIVE') === 'ACTIVE',
  status: String(profile.status ?? profile.account_status ?? 'ACTIVE') as User['status'],
  kycStatus: String(profile.kyc_level ?? '') === 'VERIFIED' ? 'approved' : 'none',
  avatarUrl: profile.avatar_path ? String(profile.avatar_path) : undefined,
  createdAt: String(profile.created_at ?? ''), updatedAt: String(profile.updated_at ?? ''),
});

async function currentAdmin(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('app_roles').select('role').eq('user_id', user.id),
  ]);
  if (profileError || roleError || !profile) return null;
  const roles = (roleRows ?? []).map((row) => row.role as AdminRole);
  return roles.length ? profileToUser(profile, roles) : null;
}

export const authService = {
  /** Connexion Supabase Auth ; `password` remplace tout contrôle bcrypt côté navigateur. */
  async loginAdmin(phone: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const { error } = await supabase.auth.signInWithPassword({ phone: phone.trim(), password });
    if (error) return { success: false, error: error.message };
    const user = await currentAdmin();
    if (!user) {
      await supabase.auth.signOut();
      return { success: false, error: 'Ce compte ne possède aucun rôle administrateur actif.' };
    }
    return { success: true, user };
  },
  async logout(): Promise<void> { await supabase.auth.signOut(); },
  async checkSession(): Promise<User | null> { return currentAdmin(); },
  async getCurrentUser(): Promise<User | null> { return currentAdmin(); },
};

export const dataService = {
  async getDashboardStats() {
    const [profiles, balances, transactions] = await Promise.all([
      supabase.from('profiles').select('id,status', { count: 'exact' }),
      supabase.from('wallet_balances').select('balance'),
      supabase.from('transactions').select('amount,status', { count: 'exact' }),
    ]);
    if (profiles.error || balances.error || transactions.error) throw profiles.error ?? balances.error ?? transactions.error;
    const rows = transactions.data ?? [];
    return {
      totalUsers: profiles.count ?? 0,
      activeUsers: (profiles.data ?? []).filter((item) => item.status === 'ACTIVE').length,
      totalWallets: (balances.data ?? []).length,
      totalBalance: (balances.data ?? []).reduce((sum, item) => sum + toNumber(item.balance), 0),
      totalTransactions: transactions.count ?? 0,
      transactionVolume: rows.filter((item) => item.status === 'SYNCED').reduce((sum, item) => sum + toNumber(item.amount), 0),
    };
  },

  async getUsers(page = 1, limit = 20, search = '', role = '', status = '') {
    const { data, error } = await supabase.rpc('admin_list_profiles', {
      p_page: page,
      p_page_size: limit,
      p_search: search || null,
      p_role: role || null,
      p_status: status || null,
    });
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const users = rows.map((profile) => ({
      ...profileToUser(profile),
      walletBalance: toNumber(profile.balance),
      walletCurrency: profile.currency_code ? String(profile.currency_code) : 'XAF',
    }));
    const total = toNumber(rows[0]?.total_count);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async setProfileStatus(profileId: string, status: User['status'], reason?: string) {
    const { error } = await supabase.rpc('admin_set_profile_status', {
      p_profile_id: profileId,
      p_status: status,
      p_reason: reason ?? null,
    });
    if (error) throw error;
  },

  async getUserById(userId: string) {
    const [profile, wallets, transactions] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('wallet_balances').select('*').eq('owner_id', userId),
      supabase.from('transactions').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: false }),
    ]);
    if (profile.error || wallets.error || transactions.error) throw profile.error ?? wallets.error ?? transactions.error;
    return { ...profileToUser(profile.data), wallets: wallets.data ?? [], transactions: transactions.data ?? [] };
  },

  async getTransactions(page = 1, limit = 50, filters?: { status?: string; type?: string; fromDate?: string; toDate?: string }) {
    let query = supabase.from('transactions').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.type) query = query.eq('channel', filters.type);
    if (filters?.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters?.toDate) query = query.lte('created_at', filters.toDate);
    const { data, error, count } = await query;
    if (error) throw error;
    const transactions: Transaction[] = (data ?? []).map((item) => ({
      id: item.id, reference: item.reference, fromWalletId: item.sender_wallet_id, toWalletId: item.receiver_wallet_id,
      amount: toNumber(item.amount), fee: toNumber(item.fee), type: item.channel, status: item.status === 'SYNCED' ? 'completed' : item.status.toLowerCase(),
      description: item.note ?? undefined, createdAt: item.created_at, completedAt: item.synced_at ?? undefined,
    }));
    return { transactions, total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) };
  },

  async getPendingKyc() {
    const { data, error } = await supabase.from('kyc_documents').select('*').in('status', ['PENDING', 'UNDER_REVIEW']).order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((item): KycDocument => ({ id: item.id, userId: item.user_id, documentType: item.document_type, filePath: item.front_path, status: 'pending', createdAt: item.created_at }));
  },

  async updateKycStatus(kycId: string, status: 'approved' | 'rejected', reason?: string) {
    const { error } = await supabase.rpc('admin_review_kyc', { p_document_id: kycId, p_status: status === 'approved' ? 'APPROVED' : 'REJECTED', p_notes: reason ?? null });
    if (error) throw error;
    return { success: true };
  },

  async getPosts(page = 1, limit = 20, status?: PostStatus) {
    const { data, error } = await supabase.rpc('admin_list_posts', {
      p_page: page,
      p_page_size: limit,
      p_status: status ?? null,
    });
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      posts: rows.map((item): Post => ({
        id: String(item.id), authorId: String(item.author_id), authorName: String(item.author_name ?? ''),
        title: String(item.title), body: String(item.body), imageUrl: item.image_url ? String(item.image_url) : undefined,
        status: item.status as PostStatus, publishedAt: item.published_at ? String(item.published_at) : undefined,
        createdAt: String(item.created_at), updatedAt: String(item.updated_at),
      })),
      total: toNumber(rows[0]?.total_count),
    };
  },

  async createPost(input: { title: string; body: string; imageUrl?: string; status: PostStatus }) {
    const { data, error } = await supabase.rpc('admin_create_post', {
      p_title: input.title.trim(), p_body: input.body.trim(), p_image_url: input.imageUrl?.trim() || null, p_status: input.status,
    });
    if (error) throw error;
    return data as Record<string, unknown>;
  },

  async updatePost(id: string, input: { title: string; body: string; imageUrl?: string; status: PostStatus }) {
    const { data, error } = await supabase.rpc('admin_update_post', {
      p_post_id: id, p_title: input.title.trim(), p_body: input.body.trim(), p_image_url: input.imageUrl?.trim() || null, p_status: input.status,
    });
    if (error) throw error;
    return data as Record<string, unknown>;
  },

  async archivePost(id: string) {
    const { error } = await supabase.rpc('admin_archive_post', { p_post_id: id });
    if (error) throw error;
  },

  async getExternalOperators() {
    const { data, error } = await supabase.from('external_operators').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map((item): ExternalOperator => ({
      id: item.id, code: item.name, name: item.name, countryCode: item.country_code, type: 'mobile_money', isActive: item.is_active,
      depositEnabled: item.is_active, withdrawEnabled: item.is_active, minDeposit: toNumber(item.min_amount), maxDeposit: toNumber(item.max_amount), minWithdraw: toNumber(item.min_amount), maxWithdraw: toNumber(item.max_amount),
    }));
  },
};

/** Les buckets sont privés ; toute visualisation passe par une URL signée à durée limitée. */
export const storageService = {
  async createSignedUrl(bucket: 'kyc-private' | 'avatars' | 'transaction-proofs', path: string, expiresIn = 120) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },
};

export const realtimeService = {
  subscribeToTransactions(callback: (transaction: Transaction) => void): RealtimeChannel {
    return supabase.channel('admin-transactions').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => callback(payload.new as Transaction)).subscribe();
  },
};

export default supabase;
