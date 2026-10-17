import { Router } from 'express';
import { lessonInputSchema, gradeInputSchema } from '../../../packages/learning.js';
import { requireAccount } from '../../../packages/http-auth.js';
import type { TutorStore } from '../../../packages/tutor-state.js';
/** These endpoints capture work. Only the authenticated Go agent authors lessons and feedback. */
export function createLearningRouter(store:TutorStore){
  const router=Router();
  router.use(['/lesson','/grade','/study'],requireAccount);
  router.get('/study',(_req,res)=>res.json({study:store.getStudySession(res.locals.ownerId)}));
  router.delete('/study',(_req,res)=>{store.clearStudySession(res.locals.ownerId);res.json({ok:true});});
  router.post('/lesson',(req,res)=>{
    const input=lessonInputSchema.safeParse(req.body);if(!input.success){res.status(400).json({error:input.error.issues[0].message});return;}
    res.status(202).json(store.startStudySession(res.locals.ownerId,input.data));
  });
  router.post('/grade',(req,res)=>{
    const input=gradeInputSchema.safeParse(req.body);if(!input.success){res.status(400).json({error:input.error.issues[0].message});return;}
    res.status(202).json(store.submitPracticeAnswer(res.locals.ownerId,input.data));
  });
  return router;
}
