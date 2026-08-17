import { useRef, useState } from 'react';
import { Camera, Check, Circle, FolderKanban, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDone } from '@/contexts/DoneContext';
import { getTaskAssignees, type Member, type Pronouns } from '@/lib/done';

const pronounOptions: Pronouns[] = ['she/her', 'he/him', 'them/they'];

const resizeAvatar = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that image.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('That image format is not supported.'));
    image.onload = () => {
      const size = 320;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Could not prepare that image.'));
      const crop = Math.min(image.width, image.height);
      context.drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2, crop, crop, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.src = reader.result as string;
  };
  reader.readAsDataURL(file);
});

export function MemberProfileDialog({ member, canEdit, canRemove, onClose }: { member: Member; canEdit: boolean; canRemove: boolean; onClose: () => void }) {
  const { data, updateMember, removeMember } = useDone();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(member.name);
  const [pronouns, setPronouns] = useState<Pronouns | null>(member.pronouns ?? null);
  const [personalityHints, setPersonalityHints] = useState(member.personalityHints ?? '');
  const [avatar, setAvatar] = useState(member.avatar);
  const [processingImage, setProcessingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const associatedTasks = data.tasks.filter(task => {
    const assignees = getTaskAssignees(task);
    return assignees.includes(member.id) || Boolean(member.userId && assignees.includes(member.userId));
  });
  const openTasks = associatedTasks.filter(task => !task.completed);
  const completedTasks = associatedTasks.filter(task => task.completed);

  const chooseImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error('Choose an image smaller than 6 MB.');
      return;
    }
    setProcessingImage(true);
    try {
      setAvatar(await resizeAvatar(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare that image.');
    } finally {
      setProcessingImage(false);
    }
  };

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName || !canEdit || saving) return;
    setSaving(true);
    try {
      await updateMember(member.id, {
        name: cleanName,
        initial: cleanName.charAt(0).toUpperCase(),
        pronouns: pronouns ?? undefined,
        personalityHints: personalityHints.trim() || undefined,
        avatar,
      });
      toast.success(`${cleanName}’s profile is up to date.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That profile could not be updated.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!canRemove || removing) return;
    setRemoving(true);
    try {
      await removeMember(member.id);
      toast.success(`${member.name} was removed from this household.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That member could not be removed.');
      setRemoving(false);
    }
  };

  const renderTask = (task: typeof associatedTasks[number]) => {
    const project = data.projects.find(item => item.id === task.project);
    return <div key={task.id} className="flex items-start gap-3 border-b py-3 last:border-0"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${task.completed ? 'border-primary bg-secondary text-primary' : 'border-foreground/20'}`}>{task.completed ? <Check size={14} strokeWidth={3}/> : <Circle size={10}/>}</span><div className="min-w-0 flex-1"><p className={`text-sm font-bold ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title}</p><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">{task.due && <span>{task.due}</span>}{project && <span className="flex items-center gap-1"><FolderKanban size={12}/>{project.name}</span>}</div></div></div>;
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-2xl"><DialogHeader><DialogTitle className="text-3xl">Family profile</DialogTitle><DialogDescription>{canEdit ? 'Keep their details useful, personal, and unmistakably them.' : 'Profile details and the work currently on their plate.'}</DialogDescription></DialogHeader>
    <div className="grid gap-7 pt-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-5">
        <div className="flex items-center gap-4"><div className="relative"><Avatar className="h-24 w-24 border-4 border-card shadow-sm"><AvatarImage src={avatar} alt={name}/><AvatarFallback style={{ background: member.color }} className="text-2xl font-bold text-white">{name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>{canEdit && <button type="button" onClick={() => fileInput.current?.click()} className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow" aria-label="Choose profile image">{processingImage ? <Loader2 className="animate-spin" size={17}/> : <Camera size={17}/>}</button>}<input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={event => { void chooseImage(event.target.files?.[0]); event.currentTarget.value = ''; }}/></div><div><p className="font-bold">Profile image</p>{canEdit ? <><button type="button" onClick={() => fileInput.current?.click()} className="mt-1 flex items-center gap-1 text-sm font-bold text-primary"><Upload size={14}/>Upload a photo</button>{avatar && <button type="button" onClick={() => setAvatar(undefined)} className="mt-1 block text-xs text-muted-foreground hover:text-destructive">Remove image</button>}</> : <p className="mt-1 text-sm text-muted-foreground">Managed by a household admin.</p>}</div></div>
        <div><label htmlFor="profile-name" className="text-sm font-bold">Name</label><Input id="profile-name" value={name} onChange={event => setName(event.target.value)} disabled={!canEdit} maxLength={60} className="mt-2 h-12 rounded-2xl bg-background px-4"/></div>
        <div><p className="text-sm font-bold">Preferred pronouns</p><div className="mt-2 flex flex-wrap gap-2">{pronounOptions.map(option => <button key={option} type="button" disabled={!canEdit} aria-pressed={pronouns === option} onClick={() => setPronouns(current => current === option ? null : option)} className={`rounded-full border px-3 py-2 text-sm font-bold transition disabled:cursor-default ${pronouns === option ? 'border-primary bg-secondary text-primary' : 'bg-background text-muted-foreground hover:border-primary/50'}`}>{option}</button>)}</div></div>
        <div><label htmlFor="personality-hints" className="text-sm font-bold">Personality & humor hints</label><p className="mt-1 text-xs text-muted-foreground">A little context for warmer, funnier task celebrations—favorite jokes, hobbies, or their sense of humor.</p><textarea id="personality-hints" value={personalityHints} onChange={event => setPersonalityHints(event.target.value)} disabled={!canEdit} placeholder="e.g. Loves dry humor, strong coffee, and terrible gardening puns" maxLength={280} className="mt-2 min-h-28 w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none ring-primary focus:ring-2 disabled:cursor-default disabled:opacity-70"/></div>
      </div>
      <div><div className="mb-3 flex items-end justify-between"><div><p className="eyebrow text-primary">On their plate</p><h3 className="mt-1 text-xl">Associated tasks</h3></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">{openTasks.length} open</span></div><div className="paper-card px-4">{openTasks.length ? openTasks.map(renderTask) : <p className="py-8 text-center text-sm text-muted-foreground">Nothing open. A suspiciously peaceful plate.</p>}</div>{completedTasks.length > 0 && <div className="mt-5"><p className="eyebrow mb-2">Completed · {completedTasks.length}</p><div className="paper-card px-4 opacity-75">{completedTasks.map(renderTask)}</div></div>}</div>
    </div>
    {confirmingRemove && <div className="mt-2 rounded-2xl border border-destructive/25 bg-destructive/10 p-4"><p className="font-bold text-destructive">Remove {member.name}?</p><p className="mt-1 text-sm text-muted-foreground">They’ll lose access to this household. Their assigned tasks will return to the household.</p><div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => setConfirmingRemove(false)} className="h-10 flex-1 rounded-full font-bold">Keep member</Button><Button variant="destructive" onClick={() => void remove()} disabled={removing} className="h-10 flex-1 rounded-full font-bold">{removing && <Loader2 className="mr-2 animate-spin" size={16}/>}Remove</Button></div></div>}
    <div className="mt-2 flex flex-wrap gap-3">{canRemove && !confirmingRemove && <Button variant="outline" onClick={() => setConfirmingRemove(true)} className="h-12 rounded-full border-destructive/30 px-5 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="mr-2" size={17}/>Remove</Button>}<Button variant="outline" onClick={onClose} className="h-12 flex-1 rounded-full font-bold">{canEdit ? 'Cancel' : 'Close'}</Button>{canEdit && <Button onClick={() => void save()} disabled={!name.trim() || processingImage || saving} className="h-12 flex-1 rounded-full font-bold">{saving && <Loader2 className="mr-2 animate-spin" size={17}/>}Save profile</Button>}</div>
  </DialogContent></Dialog>;
}
