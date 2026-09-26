import type {NextRequest} from 'next/server';

/** Development hosts that may post to the API besides the configured APP_URL. */
const DEV_ORIGINS=['http://localhost:3100','http://127.0.0.1:3100'];

/**
 * State changing requests must come from the app itself. The browser sets
 * Origin on every cross site POST, so a form on another site is refused here
 * before any session is read.
 */
export function trustedOrigin(req:NextRequest){
 const origin=req.headers.get('origin');
 if(!origin)return false;
 return origin===req.nextUrl.origin||origin===process.env.APP_URL||(process.env.NODE_ENV!=='production'&&DEV_ORIGINS.includes(origin));
}
