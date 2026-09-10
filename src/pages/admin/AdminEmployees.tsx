import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Eye, Send, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import AddEmployeeDialog from '@/components/admin/AddEmployeeDialog';
import SendNotificationDialog from '@/components/admin/SendNotificationDialog';

const OWNER_EMAIL = 'amisrsolayman@gmail.com';

const ROLE_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  admin: { label: 'Admin', variant: 'default' },
  editor: { label: 'Editor', variant: 'secondary' },
  viewer: { label: 'Viewer', variant: 'outline' },
  order_manager: { label: 'Order Manager', variant: 'secondary' },
  product_manager: { label: 'Product Manager', variant: 'secondary' },
};

export default function AdminEmployees() {
  const [addOpen, setAddOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsOwner(session.user.email === OWNER_EMAIL);
        // Check if user has admin role for notification sending
        supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' }).then(({ data }) => {
          if (data) setIsOwner(true); // Any admin can send notifications
        });
      }
    });
  }, []);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/manage-employee', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/manage-employee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Role আপডেট হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch { toast.error('ব্যর্থ হয়েছে'); }
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/manage-employee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: userId, is_active: !currentActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(currentActive ? 'নিষ্ক্রিয় করা হয়েছে' : 'সক্রিয় করা হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch { toast.error('ব্যর্থ হয়েছে'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">এমপ্লয়ী ম্যানেজমেন্ট</h1>
          <p className="text-sm text-muted-foreground">সব employee এবং তাদের role দেখুন ও পরিবর্তন করুন</p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button variant="outline" onClick={() => setNotifyOpen(true)}>
              <Send className="h-4 w-4 mr-2" /> বার্তা পাঠান
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> নতুন Employee
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee তালিকা ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">লোড হচ্ছে...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp: any) => {
                    const isOwner = emp.email === OWNER_EMAIL;
                    const roleInfo = ROLE_LABELS[emp.role] || ROLE_LABELS.viewer;
                    return (
                      <TableRow key={emp.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={emp.avatar_url || ''} />
                              <AvatarFallback className="text-xs">{(emp.full_name || emp.email)[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-2">
                              <Link to={`/admin/employees/${emp.user_id}`} className="font-medium hover:underline">
                                {emp.full_name || 'স্বর্ণ সুতা'}
                              </Link>
                              {isOwner && (
                                <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0">
                                  <Crown className="h-3 w-3" />
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{emp.email}</TableCell>
                        <TableCell>
                          {isOwner ? (
                            <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
                          ) : (
                            <Select value={emp.role} onValueChange={(v) => handleRoleChange(emp.user_id, v)}>
                              <SelectTrigger className="w-[160px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={emp.is_active ? 'default' : 'destructive'}>
                            {emp.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!isOwner && (
                              <Button variant="outline" size="sm" onClick={() => toggleActive(emp.user_id, emp.is_active)}>
                                {emp.is_active ? 'নিষ্ক্রিয়' : 'সক্রিয়'}
                              </Button>
                            )}
                            <Link to={`/admin/employees/${emp.user_id}`}>
                              <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['employees'] })} />
      <SendNotificationDialog open={notifyOpen} onOpenChange={setNotifyOpen} employees={employees} />
    </div>
  );
}
