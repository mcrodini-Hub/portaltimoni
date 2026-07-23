// Autenticação via Google Identity Services (GIS).
// Usa o fluxo de token OAuth 2.0 para navegador (sem backend): o usuário
// autoriza no popup do Google e recebemos um access token para chamar as
// APIs do Calendar e do Sheets diretamente do front-end.

const ReuniõesAuth = (() => {
  let tokenClient = null;
  let accessToken = null;
  let onChangeCallback = null;

  function init(onChange) {
    onChangeCallback = onChange;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: REUNIOES_CONFIG.CLIENT_ID,
      scope: REUNIOES_CONFIG.SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('Erro de autenticação:', response);
          return;
        }
        accessToken = response.access_token;
        onChangeCallback && onChangeCallback(true);
      }
    });
  }

  function signIn() {
    tokenClient.requestAccessToken({ prompt: '' });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    onChangeCallback && onChangeCallback(false);
  }

  function isSignedIn() {
    return !!accessToken;
  }

  function getToken() {
    return accessToken;
  }

  return { init, signIn, signOut, isSignedIn, getToken };
})();
