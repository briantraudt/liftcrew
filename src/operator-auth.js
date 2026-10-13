// Production email links must not inherit a development or preview origin.
export const CONFIRMATION_URL='https://myliftcrew.com/operator-confirmed.html';
export const OPERATOR_LOGIN_URL='https://myliftcrew.com/operators.html';
export const LOGIN_PATH='/operators.html?mode=signin';
export function confirmationParameters(url){
 const current=new URL(url),query=current.searchParams,hash=new URLSearchParams(current.hash.slice(1));
 return {error:query.get('error_description')||hash.get('error_description')||query.get('error')||hash.get('error'),tokenHash:query.get('token_hash'),type:query.get('type')||hash.get('type'),code:query.get('code'),accessToken:hash.get('access_token'),refreshToken:hash.get('refresh_token')};
}
