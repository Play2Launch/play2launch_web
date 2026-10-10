import {expect,it} from 'vitest';
import {publicAvatarURL} from './avatar';

const oldURL = 'https://api.play2launch.com/api/v1/avatars/0123456789abcdef0123456789abcdef.jpg';

it('uses the www avatar proxy for old uploaded avatars on the production site',()=>{
  expect(publicAvatarURL(oldURL,'www.play2launch.com')).toBe('https://www.play2launch.com/avatars/0123456789abcdef0123456789abcdef.jpg');
});

it('leaves avatar URLs unchanged in local development and for external providers',()=>{
  expect(publicAvatarURL(oldURL,'localhost')).toBe(oldURL);
  expect(publicAvatarURL('https://t.me/example.jpg','www.play2launch.com')).toBe('https://t.me/example.jpg');
  expect(publicAvatarURL('https://api.play2launch.com/api/v1/avatars/not-ours.jpg','www.play2launch.com')).toBe('https://api.play2launch.com/api/v1/avatars/not-ours.jpg');
});
