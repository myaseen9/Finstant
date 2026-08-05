import { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import Layout from '@/components/Layout/Layout';
import ChatWindow from '@/components/ChatWindow/ChatWindow';

export default function Home() {
  const { user } = useContext(AppContext);
  const router = useRouter();
  
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  useEffect(() => {
    if (user === null) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (user) {
      fetch('http://localhost:8000/chats', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setChats(prev => {
              const localMap = new Map(prev.map(c => [c.id, c]));
              return data.map(serverChat => {
                const localChat = localMap.get(serverChat.id);
                if (localChat) {
                  return { ...serverChat, pinned: localChat.pinned, archived: localChat.archived, title: localChat.title || serverChat.title };
                }
                return serverChat;
              });
            });
          }
        })
        .catch(err => console.error("Failed to fetch chats:", err));
    }
  }, [user, activeChatId]);

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
