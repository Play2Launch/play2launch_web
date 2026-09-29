// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../lib/api';
import { listTeams, type ServerTeam } from '../lib/teams';
import { CampaignTeamsPreview } from './CampaignTeamsPreview';
vi.mock('../lib/teams', () => ({ listTeams: vi.fn() }));
const teams = [1, 2, 3, 4].map(i => ({ id: `tm${i}`, name: `Team ${i}`, initial: 'T', color: '#aabbcc', players: i, handle: '', description: '' })) as ServerTeam[];
function mount(slug = 'other') { return render(<MemoryRouter><CampaignTeamsPreview slug={slug} /></MemoryRouter>); }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.mocked(listTeams).mockReset(); });
it('shows the top three in server ranking order with real links and scores', async () => {
  vi.mocked(listTeams).mockResolvedValue(teams);
  const request = vi.spyOn(api, 'request').mockResolvedValue({ teams: [4, 2, 1, 3].map(i => ({ id: `tm${i}`, score: 100 * i })), includes_auto_players: true });
  mount();
  await screen.findByText('Team 4');
  expect(screen.getAllByRole('heading').map(x => x.textContent)).toEqual(['Team 4', 'Team 2', 'Team 1']);
  expect(screen.queryByText('Team 3')).toBeNull();
  expect(screen.getByText('Team 4').closest('a')?.getAttribute('href')).toBe('/campaign/other/teams?selected=tm4');
  expect(screen.getByText('400')).toBeTruthy();
  expect(screen.getByText(/Includes platform automated players/)).toBeTruthy();
  expect(request.mock.calls[0][0]).toBe('/campaigns/other/rankings');
});
it('excludes Community from the ranked and fallback team preview', async () => {
  vi.mocked(listTeams).mockResolvedValue([{...teams[0],id:'tmcommunity',name:'P2L Community',team_type:'system_community'},...teams]);
  vi.spyOn(api, 'request').mockResolvedValue({ teams: [] });
  mount();
  await screen.findByText('Team 1');
  expect(screen.queryByText('P2L Community')).toBeNull();
});
it('falls back to existing teams without inventing ranks or scores', async () => {
  vi.mocked(listTeams).mockResolvedValue(teams);
  vi.spyOn(api, 'request').mockResolvedValue({ teams: [] });
  mount();
  await screen.findByText('Team 1');
  expect(screen.getAllByText('No scores yet')).toHaveLength(3);
  expect(screen.queryByText(/#1 IN THE BATTLE/)).toBeNull();
});
it('distinguishes no teams from load failure and supports retry', async () => {
  vi.mocked(listTeams).mockResolvedValue([]);
  const request = vi.spyOn(api, 'request').mockRejectedValue(new Error('offline'));
  mount();
  await screen.findByRole('alert');
  expect(screen.queryByText('No teams yet')).toBeNull();
  request.mockResolvedValue({ teams: [] });
  fireEvent.click(screen.getByText('Retry teams'));
  await screen.findByText('No teams yet');
});
it('preserves the last snapshot on refresh failure but resets on campaign change', async () => {
  vi.mocked(listTeams).mockResolvedValue(teams);
  const request = vi.spyOn(api, 'request').mockResolvedValue({ teams: [] });
  const view = mount();
  await screen.findByText('Team 1');
  request.mockRejectedValue(new Error('offline'));
  fireEvent(window, new Event('focus'));
  await screen.findByText('Could not refresh. Showing last team snapshot.');
  expect(screen.getByText('Team 1')).toBeTruthy();
  view.rerender(<MemoryRouter><CampaignTeamsPreview slug="new" /></MemoryRouter>);
  expect(screen.queryByText('Team 1')).toBeNull();
  await screen.findByText('Campaign teams unavailable.');
});
