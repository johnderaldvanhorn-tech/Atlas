(function(global){
  'use strict';

  class QueryBuilder {
    constructor(client, table){
      this.client=client;
      this.table=table;
      this.method='GET';
      this.body=undefined;
      this.params=new URLSearchParams();
      this.headers={};
    }
    select(columns='*'){
      if(this.method==='GET') this.method='GET';
      this.params.set('select',columns);
      if(this.method!=='GET' && !String(this.headers.Prefer||'').includes('return=representation')){
        this.headers.Prefer=[this.headers.Prefer,'return=representation'].filter(Boolean).join(',');
      }
      return this;
    }
    insert(values){
      this.method='POST';
      this.body=values;
      this.headers.Prefer='return=representation';
      return this;
    }
    upsert(values,options={}){
      this.method='POST';
      this.body=values;
      const prefers=['resolution=merge-duplicates','return=representation'];
      if(options.ignoreDuplicates) prefers[0]='resolution=ignore-duplicates';
      this.headers.Prefer=prefers.join(',');
      if(options.onConflict) this.params.set('on_conflict',options.onConflict);
      return this;
    }
    update(values){
      this.method='PATCH';
      this.body=values;
      this.headers.Prefer='return=representation';
      return this;
    }
    delete(){
      this.method='DELETE';
      this.headers.Prefer='return=representation';
      return this;
    }
    eq(column,value){
      this.params.append(column,`eq.${encodeURIComponent(value)}`);
      return this;
    }
    limit(value){
      this.params.set('limit',String(value));
      return this;
    }
    order(column,options={}){
      this.params.set('order',`${column}.${options.ascending===false?'desc':'asc'}`);
      return this;
    }
    single(){
      this.headers.Accept='application/vnd.pgrst.object+json';
      return this;
    }
    then(resolve,reject){
      return this.execute().then(resolve,reject);
    }
    async execute(){
      const query=this.params.toString();
      const endpoint=`${this.client.url}/rest/v1/${encodeURIComponent(this.table)}${query?`?${query}`:''}`;
      const headers={
        apikey:this.client.key,
        Authorization:`Bearer ${this.client.key}`,
        Accept:'application/json',
        ...this.headers
      };
      if(this.body!==undefined) headers['Content-Type']='application/json';
      try{
        const response=await fetch(endpoint,{method:this.method,headers,body:this.body===undefined?undefined:JSON.stringify(this.body)});
        const text=await response.text();
        let data=null;
        if(text){
          try{data=JSON.parse(text);}catch{data=text;}
        }
        if(!response.ok){
          const message=(data&&typeof data==='object'&&(data.message||data.error_description||data.hint))||`Supabase request failed (${response.status})`;
          return {data:null,error:{message,code:data&&data.code,status:response.status,details:data&&data.details,hint:data&&data.hint}};
        }
        return {data,error:null,count:null,status:response.status,statusText:response.statusText};
      }catch(error){
        return {data:null,error:{message:error&&error.message?error.message:'Network request failed',code:'NETWORK_ERROR'}};
      }
    }
  }

  class SupabaseClient {
    constructor(url,key){
      if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url||'')) throw new Error('Enter a valid Supabase project URL.');
      if(!key||key.length<20) throw new Error('Enter a valid Supabase publishable or anon key.');
      this.url=url.replace(/\/$/,'');
      this.key=key;
    }
    from(table){return new QueryBuilder(this,table);}
  }

  global.supabase={
    createClient(url,key){return new SupabaseClient(url,key);}
  };
})(window);
