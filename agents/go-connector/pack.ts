import * as sdk from '@codahq/packs-sdk';

export const pack = sdk.newPack();
pack.addMCPServer({
  name: 'SuperTutor',
  endpointUrl: 'https://super-tutor-mauve.vercel.app/mcp',
});
pack.setUserAuthentication({
  type: sdk.AuthenticationType.HeaderBearerToken,
  instructionsUrl: 'https://super-tutor-mauve.vercel.app/#connect',
});
pack.addNetworkDomain('super-tutor-mauve.vercel.app');
