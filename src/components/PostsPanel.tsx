import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Plus, RefreshCw } from 'lucide-react';
import { dataService, type Post, type PostStatus } from '../lib/supabase';

export function PostsPanel() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<PostStatus>('DRAFT');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await dataService.getPosts(1, 100);
      setPosts(result.posts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Les publications sont indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setWorking(true);
    setMessage('');
    try {
      await dataService.createPost({ title, body, status });
      setTitle('');
      setBody('');
      setStatus('DRAFT');
      await load();
      setMessage('Publication enregistrée dans Supabase.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Création impossible.');
    } finally {
      setWorking(false);
    }
  };

  const archive = async (post: Post) => {
    if (!window.confirm(`Archiver « ${post.title} » ?`)) return;
    setWorking(true);
    try {
      await dataService.archivePost(post.id);
      await load();
      setMessage('Publication archivée.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Archivage impossible.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="space-y-5">
      <form className="card space-y-4 p-5" onSubmit={(event) => void create(event)}>
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Nouvelle publication</h2><p className="mt-1 text-sm text-slate-500">Le contenu sera sauvegardé dans le backend Supabase personnel.</p></div><Plus className="h-5 w-5 text-brand" /></div>
        <input className="input" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de la publication" />
        <textarea className="input min-h-32" required maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Contenu affiché aux utilisateurs" />
        <div className="flex flex-wrap items-center justify-between gap-3"><select className="input max-w-xs" value={status} onChange={(event) => setStatus(event.target.value as PostStatus)}><option value="DRAFT">Brouillon</option><option value="PUBLISHED">Publier maintenant</option></select><button className="btn btn-primary" type="submit" disabled={working}>{working ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </form>
      {message && <p role="status" className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">{message}</p>}
      <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold">Publications enregistrées</h2><p className="text-sm text-slate-500">{posts.length} publication(s) chargée(s) depuis Supabase.</p></div><button className="btn btn-secondary p-2" onClick={() => void load()} disabled={loading} title="Actualiser"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div><div className="divide-y divide-slate-100">{loading ? <p className="px-5 py-10 text-center text-slate-500">Chargement…</p> : posts.length === 0 ? <p className="px-5 py-10 text-center text-slate-500">Aucune publication enregistrée.</p> : posts.map((post) => <article key={post.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{post.title}</h3><span className="badge badge-warning">{post.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{post.body}</p><p className="mt-2 text-xs text-slate-400">{new Date(post.createdAt).toLocaleString('fr-FR')} · {post.authorName}</p></div>{post.status !== 'ARCHIVED' && <button className="btn btn-secondary shrink-0 p-2 text-slate-600" disabled={working} onClick={() => void archive(post)} title="Archiver"><Archive className="h-4 w-4" /></button>}</article>)}</div></section>
    </section>
  );
}
