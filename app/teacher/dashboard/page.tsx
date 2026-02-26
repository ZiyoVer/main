'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Save } from 'lucide-react';

export default function TeacherDashboard() {
    const [questions, setQuestions] = useState([{ questionText: '', correctAnswer: '', difficulty: 0, topic: '' }]);

    const addQuestion = () => {
        setQuestions([...questions, { questionText: '', correctAnswer: '', difficulty: 0, topic: '' }]);
    };

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Teacher Portal</h1>
                <p className="text-muted-foreground mt-2">Create tests and manage questions for the adaptive learning system.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Create New Test</CardTitle>
                    <CardDescription>Add questions and assign initial difficulty levels (Logits).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Test Title</Label>
                            <Input placeholder="e.g. Algebra Midterm Review" />
                        </div>
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Select defaultValue="math">
                                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="math">Mathematics</SelectItem>
                                    <SelectItem value="lang">Native Language</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg">Questions</h3>
                        {questions.map((q, i) => (
                            <Card key={i} className="bg-zinc-50 dark:bg-zinc-900/50">
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-muted-foreground font-bold">Question {i + 1}</Label>
                                        <div className="flex gap-4 items-center">
                                            <Label className="text-xs">Initial Difficulty (Logit)</Label>
                                            <Input type="number" step="0.1" defaultValue={0} className="w-20" title="Higher = Harder. 0 is average." />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Question Text</Label>
                                        <Input placeholder="Enter the question here..." />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Correct Answer</Label>
                                            <Input placeholder="Exact correct answer" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Topic Focus (For AI tracking)</Label>
                                            <Input placeholder="e.g. Quadratics" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        <Button variant="outline" className="w-full border-dashed" onClick={addQuestion}>
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Add Another Question
                        </Button>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-4 border-t px-6 py-4">
                    <Button variant="ghost">Cancel</Button>
                    <Button className="gap-2">
                        <Save className="w-4 h-4" />
                        Save Next Adaptive Test
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
