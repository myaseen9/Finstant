import { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import Layout from '@/components/Layout/Layout';
import ChatWindow from '@/components/ChatWindow/ChatWindow';

export default function Home() {
  const { user, chats, setChats, activeChatId, setActiveChatId } = useContext(AppContext);
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) return null; // Or a loading spinner while redirecting

  return (
    <Layout 
      chats={chats} 
      setChats={setChats} 
      activeChatId={activeChatId}
      setActiveChatId={setActiveChatId}
    >
      <ChatWindow chatId={activeChatId} setActiveChatId={setActiveChatId} />
    </Layout>
  );
}
