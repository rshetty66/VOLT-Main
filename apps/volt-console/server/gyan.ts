import express from "express";
import fs from "node:fs";
import {Readable} from "node:stream";
import {listUploads,uploadMeta,originalPath} from "./uploads.js";
import { requestUser,type SecurityConfig } from "./security.js";

/** Explicit membership, verified identity and fixed private destination. No upstream headers from the browser. */
export function gyanRouter(security:SecurityConfig){
  const r=express.Router();
  r.use(express.json({limit:"3mb"}));
  r.use(async(req,res)=>{
    const route=req.path.replace(/^\//,"");
    const paths=/^(catalog|definitions|drafts|simulate|simulate-stream|sources|knowledge|import-knowledge|sources\/[a-f0-9]{64}|template\/(close|variance|match)|confirmed-draft|remote-snapshot|tools\/[A-Za-z0-9_-]+|runs|runs\/[0-9a-f-]{36}\/(trace|decision))$/;
    if(!paths.test(route)||!["GET","POST"].includes(req.method))return void res.sendStatus(404);
    const hostport=process.env.GYAN_INTERNAL_HOSTPORT;
    const url=process.env.GYAN_INTERNAL_URL || (hostport ? `http://${hostport}` : undefined),secret=process.env.GYAN_INTERNAL_TOKEN;
    if(!url||!secret||secret.length<32)return void res.status(503).json({error:"Gyan runtime is not connected. Visual design is available; simulations are disabled."});
    const actor=security.authMode==="password"?requestUser(security,req):undefined;
    if(!actor)return void res.status(403).json({error:"Simulation requires a verified password session and project membership."});
    const project=req.get("x-volt-project")??"";
    let role:string|undefined;
    try{const acl=JSON.parse(process.env.GYAN_PROJECT_ROLES??"{}");if(Object.hasOwn(acl,project)&&Object.hasOwn(acl[project],actor))role=acl[project][actor];}catch{/* fail closed */}
    if(!role||!["designer","controller","reader"].includes(role))return void res.status(403).json({error:"No Gyan membership for this project."});
    try{
      if(route==="knowledge")return void res.json(listUploads(project).filter(x=>x.bytes<=2_000_000 && /\.(csv|tsv|txt|xlsx|pdf)$/i.test(x.name)).map(({id,name})=>({id,name})));
      let body=req.body;
      if(route==="import-knowledge"){
        if(req.method!=="POST"||role==="reader")return void res.sendStatus(403);
        const id=body?.id;if(typeof id!=="string")return void res.sendStatus(400);
        const meta=uploadMeta(id),path=originalPath(id);
        if(!meta||!path||(meta.projectId??"general")!==project)return void res.sendStatus(404);
        if(fs.statSync(path).size>2_000_000)return void res.sendStatus(413);
        body={name:meta.name,content:fs.readFileSync(path).toString("base64")};
      }
      const endpoint=new URL(`/studio/${route==="import-knowledge"?"sources":route}`,url);
      for(const k of ["offset","limit","after","kind","q"])if(typeof req.query[k]==="string")endpoint.searchParams.set(k,req.query[k]);
      const upstream=await fetch(endpoint,{method:req.method,redirect:"error",signal:AbortSignal.timeout(60000),
        headers:{authorization:`Bearer ${secret}`,"content-type":"application/json","x-gyan-project":project,"x-gyan-actor":actor,"x-gyan-role":role},
        body:req.method==="POST"?JSON.stringify(body):undefined});
      const type=upstream.headers.get("content-type")??"application/json";
      res.set("Cache-Control","no-store").status(upstream.status).type(type);
      if(type.startsWith("text/event-stream")&&upstream.body){
        res.flushHeaders();const stream=Readable.from(upstream.body as unknown as AsyncIterable<Uint8Array>);
        stream.on("error",()=>res.end());res.on("close",()=>stream.destroy());stream.pipe(res);
      }else res.send(await upstream.text());
    }catch{res.status(503).json({error:"Gyan runtime unavailable. Nothing was posted."});}
  });
  return r;
}
