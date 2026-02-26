'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Target, BookOpen, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Dashboard</h1>
          <p className="text-muted-foreground mt-2">Track your progress towards the National Certificate.</p>
        </div>
        <Link href="/tests/next">
          <Button size="lg" className="gap-2">
            <Brain className="w-5 h-5" />
            Take Next Adaptive Test
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estimated Readiness</CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">68%</div>
            <p className="text-xs text-muted-foreground mt-1">Based on recent AI analysis. Target is 80%.</p>
            {/* Hidden Rasch logic: Logit converted to probability percentage */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tests Completed</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-1">4 this week</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-400">Weak Topics</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-500">3 Topics</div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Need review before next test</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Topics to Review</CardTitle>
            <CardDescription>The AI noticed you struggle with these. Click to chat with the tutor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {['Logarithm properties', 'Trigonometric identities', 'Probability theory'].map((topic, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-4">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                  <div>
                    <h4 className="font-semibold">{topic}</h4>
                    <p className="text-sm text-muted-foreground">Mistakes made in last 3 tests</p>
                  </div>
                </div>
                <Link href={`/chat?topic=${encodeURIComponent(topic)}`}>
                  <Button variant="outline" size="sm">Ask Tutor</Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest test results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: 'Mock Exam 2', score: '72%', date: '2 days ago' },
              { name: 'Algebra Quiz', score: '85%', date: '4 days ago' },
              { name: 'Geometry Basics', score: '60%', date: '1 week ago' },
            ].map((activity, i) => (
              <div key={i} className="flex flex-col gap-1 pb-4 border-b last:border-0 last:pb-0">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{activity.name}</span>
                  <span className="font-bold">{activity.score}</span>
                </div>
                <span className="text-xs text-muted-foreground">{activity.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
