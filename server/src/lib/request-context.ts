import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  userId?: string;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

export const getRequestContext = (): RequestContext | undefined =>
  requestContext.getStore();

export const getRequestId = (): string | undefined =>
  requestContext.getStore()?.requestId;

export const getUserId = (): string | undefined =>
  requestContext.getStore()?.userId;

export const setRequestUserId = (userId: string): void => {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
};

export const runWithRequestContext = <T>(
  context: RequestContext,
  callback: () => T
): T => requestContext.run(context, callback);

export default requestContext;
