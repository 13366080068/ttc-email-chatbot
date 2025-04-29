'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface EmailCardProps {
  initialData: {
    title: string;
    body: string;
    receiver: string;
  };
  onAccept: (data: { title: string; body: string; receiver: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
  isSuperseded?: boolean;
}

export default function EmailCard({ initialData, onAccept, onCancel, isLoading, isSuperseded = false }: EmailCardProps) {
  const [title, setTitle] = useState(initialData.title);
  const [body, setBody] = useState(initialData.body);
  const [receiver, setReceiver] = useState(initialData.receiver);

  useEffect(() => {
    setTitle(initialData.title);
    setBody(initialData.body);
    setReceiver(initialData.receiver);
  }, [initialData]);

  const handleAccept = () => {
    onAccept({ title, body, receiver });
  };

  const isDisabled = isLoading || isSuperseded;

  return (
    <Card className={`w-full mx-auto mt-4 border-primary border-2 shadow-lg ${isSuperseded ? 'opacity-70 border-muted' : ''}`}>
      <CardHeader>
        <CardTitle>发送邮件确认 {isSuperseded && <span className="text-sm text-muted-foreground">(已更新)</span>}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="receiver">接收者</Label>
          <Input
            id="receiver"
            value={receiver}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReceiver(e.target.value)}
            placeholder="输入接收者邮箱"
            disabled={isDisabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            placeholder="输入邮件标题"
            disabled={isDisabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">正文</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
            placeholder="输入邮件正文"
            rows={6}
            disabled={isDisabled}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 border-t pt-4 mt-4">
        <Button variant="outline" onClick={onCancel} disabled={isDisabled}>
          取消发送
        </Button>
        <Button onClick={handleAccept} disabled={isDisabled}>
          {isLoading ? '处理中...' : '确认并发送'}
        </Button>
      </CardFooter>
    </Card>
  );
} 