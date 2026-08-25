import Head from 'next/head';
import { useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import Layout from '@/components/Layout/Layout';
import UserManagement from '@/components/UserManagement/UserManagement';

export default function UsersPage() {
  const { user } = useContext(AppContext);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (user.role !== 'admin' && user.role !== 'superadmin') {
      router.push('/');
    }
  }, [user, router]);

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return null;
  }

  return (
    <Layout>
      <Head>
        <title>User Management - Finance Engine</title>
      </Head>
      <UserManagement />
    </Layout>
  );
}
