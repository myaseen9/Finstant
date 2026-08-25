import { useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import Layout from '@/components/Layout/Layout';
import AdminPanel from '@/components/AdminPanel/AdminPanel';

export default function AdminPage() {
  const { user } = useContext(AppContext);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (user.role !== 'admin' && user.role !== 'superadmin') {
      router.push('/');
    }
  }, [user, router]);

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return null;

  return (
    <Layout>
      <AdminPanel />
    </Layout>
  );
}
