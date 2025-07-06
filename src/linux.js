const dbus = require('@jellybrick/dbus-next');
const crypto = require('crypto');
const Variant = dbus.Variant;

async function setupScreenCast() {
  const bus = dbus.sessionBus();
  const castProxy = await bus.getProxyObject('org.freedesktop.portal.Desktop', '/org/freedesktop/portal/desktop');
  const screenCast = castProxy.getInterface('org.freedesktop.portal.ScreenCast');
  const sender = bus.name.replace(/[^A-Za-z0-9_]/g, '_').substring(1);
  const requestHandleToken = crypto.randomUUID().replace(/-/g, '');
  const sessionHandleToken = crypto.randomUUID().replace(/-/g, '');
  const requestHandle = `/org/freedesktop/portal/desktop/request/${sender}/${requestHandleToken}`;

  let response = new Map();
  bus.on('message', (message) => {
    if (
      message.interface === 'org.freedesktop.portal.Request' &&
      message.member === 'Response' &&
      message.path === requestHandle
    ) {
      response.get(requestHandleToken).resolve(message.body);
      response.delete(requestHandleToken);
    }
  });

  let responseBody = new Promise((resolve, reject) => { response.set(requestHandleToken, { resolve }) });
  await createScreenCastSession(screenCast, sessionHandleToken, requestHandleToken);
  sessionHandle = (await responseBody)[1].session_handle.value;

  responseBody = new Promise((resolve, reject) => { response.set(requestHandleToken, { resolve }) });
  await selectSource(screenCast, sessionHandle, requestHandleToken);
  startScreenCast(screenCast, sessionHandle, requestHandleToken)
}

async function createScreenCastSession(cast, sessionToken, requestToken) {
  await cast.CreateSession({
    handle_token: new Variant('s', requestToken),
    session_handle_token: new Variant('s', sessionToken),
  });

}

async function selectSource(cast, sessionHandle, requestToken) {
  await cast.SelectSources(sessionHandle, {
    handle_token: new Variant('s', requestToken),
    persist_mode: new Variant('u', 1),
  });
}

async function startScreenCast(cast, sessionHandle, requestToken) {
  await cast.Start(
    sessionHandle,
    '',
    {
      handle_token: new Variant('s', requestToken)
    }
  );
}

