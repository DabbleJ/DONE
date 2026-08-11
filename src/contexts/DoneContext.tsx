import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DoneData, mergeStarterData, starterData, Task } from '@/lib/done';
import { useSession } from './SessionContext';
type DoneValue={data:DoneData;toggleTask:(id:string)=>void;addTask:(task:Task)=>void;addTasks:(tasks:Task[])=>void;snoozeTask:(id:string)=>void;toggleSetting:(key:keyof DoneData['settings'])=>void};
const DoneContext=createContext<DoneValue|null>(null);
export function DoneProvider({children}:{children:React.ReactNode}){const{session}=useSession();const[data,setData]=useState<DoneData>(()=>{const saved=localStorage.getItem('done-state');return saved?mergeStarterData(JSON.parse(saved) as DoneData):starterData});
  useEffect(()=>{if(!session)return;supabase.from('app_state').select('data').eq('user_id',session.user.id).single().then(({data:row})=>{if(row?.data&&Array.isArray((row.data as unknown as DoneData).tasks))setData(mergeStarterData(row.data as unknown as DoneData))})},[session]);
  useEffect(()=>{localStorage.setItem('done-state',JSON.stringify(data));if(session)supabase.from('app_state').upsert({user_id:session.user.id,data:JSON.parse(JSON.stringify(data)),updated_at:new Date().toISOString()}).then()},[data,session]);
  const update=(fn:(d:DoneData)=>DoneData)=>setData(fn); const toggleTask=(id:string)=>update(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,completed:!t.completed}:t)})); const addTask=(task:Task)=>update(d=>({...d,tasks:[task,...d.tasks]})); const addTasks=(tasks:Task[])=>update(d=>{const existingIds=new Set(d.tasks.map(task=>task.id));return{...d,tasks:[...tasks.filter(task=>!existingIds.has(task.id)),...d.tasks]}}); const snoozeTask=(id:string)=>update(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,snoozed:true}:t)})); const toggleSetting=(key:keyof DoneData['settings'])=>update(d=>({...d,settings:{...d.settings,[key]:!d.settings[key]}}));
  return <DoneContext.Provider value={{data,toggleTask,addTask,addTasks,snoozeTask,toggleSetting}}>{children}</DoneContext.Provider>}
export const useDone=()=>{const value=useContext(DoneContext);if(!value)throw new Error('DoneProvider missing');return value};
