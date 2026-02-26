'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, User } from 'lucide-react';

function ChatContent() {
    const searchParams = useSearchParams();
    const initialTopic = searchParams.get('topic');

    const [messages, setMessages] = useState<{ role: string, content: string }[]>([
        { role: 'assistant', content: `Assalomu aleykum! Men sizning shaxsiy AI repetitoringizman. Bugun qaysi mavzuda yordam bera olaman? ${initialTopic ? "Ayniqsa '" + initialTopic + "' bo'yicha qiynalayotganingizni ko'rdim." : ''}` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const newMessages = [...messages, { role: 'user', content: input }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    topicContext: initialTopic
                })
            });
            const data = await res.json();

            if (data.content) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="border-b bg-zinc-50 dark:bg-zinc-900">
                <CardTitle className="flex items-center gap-2">
                    <Bot className="w-6 h-6 text-primary" />
                    <span>AI Tutor</span>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {m.content}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex gap-3 max-w-[80%]">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 animate-pulse" />
                            </div>
                            <div className="p-3 rounded-lg bg-muted flex gap-1 items-center">
                                <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" />
                                <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce delay-100" />
                                <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce delay-200" />
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="border-t p-4 bg-zinc-50 dark:bg-zinc-900">
                <form onSubmit={sendMessage} className="flex w-full gap-2">
                    <Input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Savolingizni yozing..."
                        className="flex-1"
                    />
                    <Button type="submit" disabled={loading || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}

export default function ChatPage() {
    return (
        <div className="max-w-4xl mx-auto h-[85vh] p-4 flex flex-col">
            <React.Suspense fallback={<div>Loading Tutor...</div>}>
                <ChatContent />
            </React.Suspense>
        </div>
    );
}
