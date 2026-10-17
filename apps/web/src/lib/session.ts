import { z } from 'zod';
import { lessonSchema, gradeSchema, type LearningSession } from '../../../../packages/learning.js';
const sessionSchema=z.object({lesson:lessonSchema.nullable(),answers:z.record(z.string().max(4000)),feedback:z.record(gradeSchema),source:z.string().max(8000),sample:z.boolean()});
export const emptySession=():LearningSession=>({lesson:null,answers:{},feedback:{},source:'',sample:false});
export function loadLearningSession(accountId:string):LearningSession{
  try{const raw=localStorage.getItem(`supertutor.learning.${accountId}`);if(!raw)return emptySession();const result=sessionSchema.safeParse(JSON.parse(raw));return result.success?result.data:emptySession();}catch{return emptySession();}
}
export function saveLearningSession(accountId:string,session:LearningSession):boolean{
  try{localStorage.setItem(`supertutor.learning.${accountId}`,JSON.stringify(session));return true;}catch{return false;}
}
