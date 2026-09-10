import { useState, useEffect } from 'react';
import { Shield, Settings, Phone, Globe, Plus, Trash2, Save, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';
import { toast } from 'sonner';
import FraudOverviewTab from '@/components/admin/FraudOverviewTab';
import FraudIpOverviewTab from '@/components/admin/FraudIpOverviewTab';

export default function AdminFraudManagement() {
  const { data: settings } = useStoreSettings();
  const updateSetting = useUpdateSetting();

  // Order settings state
  const [dupCheck, setDupCheck] = useState(false);
  const [cooldownHours, setCooldownHours] = useState('0');

  // Block lists
  const [blockedPhones, setBlockedPhones] = useState<string[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [newIp, setNewIp] = useState('');

  useEffect(() => {
    if (!settings) return;
    setDupCheck(settings['fraud_duplicate_check'] === 'true');
    setCooldownHours(settings['fraud_cooldown_hours'] || '0');
    try { setBlockedPhones(JSON.parse(settings['blocked_phones'] || '[]')); } catch { setBlockedPhones([]); }
    try { setBlockedIps(JSON.parse(settings['blocked_ips'] || '[]')); } catch { setBlockedIps([]); }
  }, [settings]);

  const saveOrderSettings = async () => {
    try {
      await updateSetting.mutateAsync({ key: 'fraud_duplicate_check', value: String(dupCheck) });
      await updateSetting.mutateAsync({ key: 'fraud_cooldown_hours', value: cooldownHours });
      toast.success('সেটিংস সেভ হয়েছে');
    } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); }
  };

  const addPhone = async () => {
    const phone = newPhone.trim();
    if (!phone) return;
    if (blockedPhones.includes(phone)) { toast.error('এই নম্বরটি আগেই ব্লক করা আছে'); return; }
    const updated = [...blockedPhones, phone];
    await updateSetting.mutateAsync({ key: 'blocked_phones', value: JSON.stringify(updated) });
    setBlockedPhones(updated);
    setNewPhone('');
    toast.success('ফোন নম্বর ব্লক করা হয়েছে');
  };

  const removePhone = async (phone: string) => {
    const updated = blockedPhones.filter(p => p !== phone);
    await updateSetting.mutateAsync({ key: 'blocked_phones', value: JSON.stringify(updated) });
    setBlockedPhones(updated);
    toast.success('ফোন নম্বর আনব্লক করা হয়েছে');
  };

  const addIp = async () => {
    const ip = newIp.trim();
    if (!ip) return;
    if (blockedIps.includes(ip)) { toast.error('এই আইপি আগেই ব্লক করা আছে'); return; }
    const updated = [...blockedIps, ip];
    await updateSetting.mutateAsync({ key: 'blocked_ips', value: JSON.stringify(updated) });
    setBlockedIps(updated);
    setNewIp('');
    toast.success('আইপি ব্লক করা হয়েছে');
  };

  const removeIp = async (ip: string) => {
    const updated = blockedIps.filter(i => i !== ip);
    await updateSetting.mutateAsync({ key: 'blocked_ips', value: JSON.stringify(updated) });
    setBlockedIps(updated);
    toast.success('আইপি আনব্লক করা হয়েছে');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ফ্রড ম্যানেজমেন্ট</h1>
            <p className="text-xs text-muted-foreground">সন্দেহজনক অর্ডার ও ব্লক তালিকা পরিচালনা</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            ওভারভিউ
          </TabsTrigger>
          <TabsTrigger value="ip-overview" className="gap-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" />
            IP ওভারভিউ
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />
            সেটিংস
          </TabsTrigger>
          <TabsTrigger value="phones" className="gap-1.5 text-xs">
            <Phone className="h-3.5 w-3.5" />
            ফোন ব্লক
            {blockedPhones.length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {blockedPhones.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ips" className="gap-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" />
            IP ব্লক
            {blockedIps.length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {blockedIps.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <FraudOverviewTab />
        </TabsContent>

        {/* IP Overview Tab */}
        <TabsContent value="ip-overview" className="mt-4">
          <FraudIpOverviewTab />
        </TabsContent>

        {/* Order Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">ডুপ্লিকেট অর্ডার চেক</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">একই ফোন নম্বর থেকে পুনরায় অর্ডার করলে সতর্কতা দেখাবে</p>
                  </div>
                </div>
                <Switch checked={dupCheck} onCheckedChange={setDupCheck} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">অর্ডার কুলডাউন সময়</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">একই ফোন থেকে আবার অর্ডার করার জন্য ন্যূনতম সময় (ঘন্টা)। 0 = কোনো সীমাবদ্ধতা নেই</p>
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  value={cooldownHours}
                  onChange={e => setCooldownHours(e.target.value)}
                  className="w-20 text-center"
                />
              </div>

              <Button onClick={saveOrderSettings} disabled={updateSetting.isPending} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <Save className="h-4 w-4 mr-2" />
                সেটিংস সেভ করুন
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phone Block Tab */}
        <TabsContent value="phones" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="ফোন নম্বর লিখুন (যেমন: 01712345678)"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPhone()}
                />
                <Button onClick={addPhone} disabled={updateSetting.isPending} size="sm" className="shrink-0 gap-1">
                  <Plus className="h-4 w-4" /> যোগ
                </Button>
              </div>

              {blockedPhones.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">কোনো ফোন নম্বর ব্লক করা হয়নি</p>
              ) : (
                <div className="space-y-2">
                  {blockedPhones.map(phone => (
                    <div key={phone} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-mono">{phone}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removePhone(phone)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP Block Tab */}
        <TabsContent value="ips" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="আইপি ঠিকানা লিখুন (যেমন: 192.168.1.1)"
                  value={newIp}
                  onChange={e => setNewIp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addIp()}
                />
                <Button onClick={addIp} disabled={updateSetting.isPending} size="sm" className="shrink-0 gap-1">
                  <Plus className="h-4 w-4" /> যোগ
                </Button>
              </div>

              {blockedIps.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">কোনো আইপি ব্লক করা হয়নি</p>
              ) : (
                <div className="space-y-2">
                  {blockedIps.map(ip => (
                    <div key={ip} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-mono">{ip}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeIp(ip)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
