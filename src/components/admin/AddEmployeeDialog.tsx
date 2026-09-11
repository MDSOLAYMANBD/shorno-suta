import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ROLES = [
  { value: 'admin', label: 'Admin', desc: 'সব কিছু করতে পারবে' },
  { value: 'editor', label: 'Editor', desc: 'এডিট করতে পারবে' },
  { value: 'viewer', label: 'Viewer', desc: 'শুধু দেখতে পারবে' },
  { value: 'order_manager', label: 'Order Manager', desc: 'অর্ডার ম্যানেজ করবে' },
  { value: 'product_manager', label: 'Product Manager', desc: 'প্রোডাক্ট ম্যানেজ করবে' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function AddEmployeeDialog({ open, onOpenChange, onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/manage-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email, password, full_name: fullName, phone, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Account তৈরি হয়েছে! Staff কে email ও password জানিয়ে দিন।');
      setEmail(''); setFullName(''); setPhone(''); setPassword(''); setRole('editor');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>নতুন Staff যোগ করুন</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>নাম</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="পুরো নাম" required />
          </div>
          <div>
            <Label>Gmail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@gmail.com" required />
          </div>
          <div>
            <Label>মোবাইল নম্বর</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <Label>অস্থায়ী পাসওয়ার্ড (staff কে জানিয়ে দিন)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর" required minLength={6} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground text-xs ml-2">— {r.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Account তৈরি হলে staff কে email ও password জানিয়ে দিন। Staff login করে নিজের password পরিবর্তন করতে পারবে।
          </p>
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading ? 'তৈরি হচ্ছে...' : 'Account তৈরি করুন'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
