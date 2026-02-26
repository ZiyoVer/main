'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Simulating API call for onboarding
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 1000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to msert</CardTitle>
          <CardDescription>Let&apos;s personalize your learning journey for the National Certificate.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Subject</Label>
              <Select defaultValue="math">
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="math">Mathematics</SelectItem>
                  <SelectItem value="lang">Native Language</SelectItem>
                  <SelectItem value="history">History</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Current Knowledge Level</Label>
              <Select defaultValue="beginner">
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner (Need to learn basics)</SelectItem>
                  <SelectItem value="intermediate">Intermediate (Know some topics)</SelectItem>
                  <SelectItem value="advanced">Advanced (Just need practice)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Grade</Label>
              <Select defaultValue="A">
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A_PLUS">A+ (86-100%)</SelectItem>
                  <SelectItem value="A">A (71-85%)</SelectItem>
                  <SelectItem value="B_PLUS">B+ (66-70%)</SelectItem>
                  <SelectItem value="B">B (60-65%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up...' : 'Start Learning'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
