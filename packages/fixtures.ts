// Student-authored sample input only. There is deliberately no fake AI feedback.
import type { AssignmentInput, WorkInput } from './types.js';
export const DEMO_ASSIGNMENT: AssignmentInput = {
  title: 'Understand a loop that never stops', subject: 'coding',
  prompt: 'Write a function that returns the sum of the integers from 1 through n. Explain why the loop terminates. Keep the solution in your own words and code.',
  materials: [{ title: 'Sample lecture excerpt: loop progress', text: 'A loop needs a condition, a body, and progress toward making the condition false. Trace the variables after one iteration before reasoning about the whole loop. This is a sample teaching excerpt, not an imported college lecture.' }],
};
export const DEMO_WORK: WorkInput = {
  work: 'def sum_to(n):\n    total = 0\n    i = 1\n    while i <= n:\n        total += i\n    return total',
  question: 'Why does this keep running? Help me find the problem without writing the finished function.',
  errorOutput: 'The function does not finish for n = 3.',
};
