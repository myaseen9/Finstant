import { useState, useContext } from 'react';
import { AppContext } from '@/pages/_app';
import Layout from '@/components/Layout/Layout';
import ChatWindow from '@/components/ChatWindow/ChatWindow';
import LandingPage from '@/components/Landing/LandingPage';

export default function Home() {
  const { user, chats, setChats, activeChatId, setActiveChatId } = useContext(AppContext);

  if (!user) {
    return <LandingPage />;
  }

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
