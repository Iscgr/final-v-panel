import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface EditAgentProfileProps {
  agent: {
    id: number;
    code: string;
    name: string;
    ownerName: string;
    panelUsername: string;
    phone?: string;
    telegramHandle?: string | null;
    salesPartnerId?: number | null;
  };
  onSuccess?: () => void;
}

const editProfileSchema = z.object({
  ownerName: z
    .string()
    .trim()
    .max(120, 'حداکثر ۱۲۰ نویسه')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  panelUsername: z
    .string()
    .trim()
    .min(3, 'حداقل ۳ نویسه')
    .max(64, 'حداکثر ۶۴ نویسه'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{5,18}$/, 'شماره تماس نامعتبر است')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  telegramHandle: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z0-9_]{5,32}$/, 'آیدی تلگرام نامعتبر است')
    .optional()
    .or(z.literal(''))
    .transform((v) =>
      v === '' ? undefined : v.startsWith('@') ? v : '@' + v
    ),
  salesPartnerId: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : Number(v))),
});

type EditProfileFormValues = z.infer<typeof editProfileSchema>;

const EditAgentProfile: React.FC<EditAgentProfileProps> = ({ agent, onSuccess }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      ownerName: agent.ownerName === '-' ? '' : agent.ownerName,
      panelUsername: agent.panelUsername,
      phone: agent.phone || '',
      telegramHandle: agent.telegramHandle || '',
      salesPartnerId: agent.salesPartnerId ? String(agent.salesPartnerId) : '' as any,
    },
  });

  // Fetch sales partners list
  const { data: salesPartners, isLoading: isLoadingSalesPartners } = useQuery<any[]>({
    queryKey: ['/api/sales-partners'],
    queryFn: async () => {
      const response = await fetch('/api/sales-partners', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch sales partners');
      return response.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (values: EditProfileFormValues) => {
      const response = await fetch(`/api/representatives/${agent.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'خطا در به‌روزرسانی پروفایل');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ موفقیت',
        description: 'پروفایل نماینده با موفقیت به‌روزرسانی شد',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/representatives/${agent.code}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/representatives/${agent.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives'] });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '❌ خطا',
        description: error.message,
      });
    },
  });

  const onSubmit = (values: EditProfileFormValues) => {
    const payload = { ...values } as any;
    if(payload.salesPartnerId === '' || payload.salesPartnerId === '__none') {
      delete payload.salesPartnerId;
    } else if (typeof payload.salesPartnerId === 'string') {
      payload.salesPartnerId = Number(payload.salesPartnerId);
    }
    updateProfileMutation.mutate(payload);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto" dir="rtl">
      <CardHeader>
        <CardTitle>ویرایش پروفایل نماینده</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            {/* نام مالک */}
            <FormField
              name="ownerName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام مالک / همکار فروش</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="نام و نام خانوادگی" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* نام کاربری پنل */}
            <FormField
              name="panelUsername"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام کاربری پنل *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* شماره تماس */}
            <FormField
              name="phone"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>شماره تماس</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="+98 912 345 6789"
                      dir="ltr"
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^\d+\s-]/g, '');
                        field.onChange(sanitized.slice(0, 18));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* آیدی تلگرام */}
            <FormField
              name="telegramHandle"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>آیدی تلگرام</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="@username"
                      dir="ltr"
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^A-Za-z0-9_@]/g, '');
                        if (val && !val.startsWith('@')) val = '@' + val;
                        field.onChange(val.slice(0, 33));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* همکار فروش */}
            <FormField
              name="salesPartnerId"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>همکار فروش</FormLabel>
                  <Select
                    onValueChange={(val)=> field.onChange(val==='__none' ? '' : val)}
                    value={field.value ? String(field.value) : '__none'}
                    disabled={isLoadingSalesPartners}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب همکار فروش (اختیاری)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">هیچکدام</SelectItem>
                      {salesPartners?.map((sp: any) => (
                        <SelectItem key={sp.id} value={String(sp.id)}>
                          {sp.name} - {sp.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* دکمه‌های عملیاتی */}
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    در حال ذخیره...
                  </>
                ) : (
                  'ذخیره تغییرات'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default EditAgentProfile;
