// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {RelayAssetSelect} from './RelayAssetSelect';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const options = [{value:'1',label:'Ethereum'},{value:'56',label:'BNB'}];

it('keeps options mounted when touch blur has no related target, then selects BNB', () => {
  const onChange = vi.fn();
  render(<RelayAssetSelect label="From chain" value="1" options={options} onChange={onChange}/>);
  fireEvent.click(screen.getByRole('button', {name:'From chain'}));
  const search = screen.getByRole('textbox');
  fireEvent.pointerDown(screen.getByRole('button', {name:'BNB'}), {pointerType:'touch'});
  fireEvent.blur(search, {relatedTarget:null});
  fireEvent.click(screen.getByRole('button', {name:'BNB'}));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('56');
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('does not open the keyboard automatically on a touch device', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true})));
  render(<RelayAssetSelect label="Pay with" value="1" options={options} onChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', {name:'Pay with'}));
  expect(document.activeElement).not.toBe(screen.getByRole('textbox'));
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('still closes when keyboard focus leaves the control', () => {
  render(<><RelayAssetSelect label="From chain" value="1" options={options} onChange={vi.fn()}/><button>Outside</button></>);
  fireEvent.click(screen.getByRole('button', {name:'From chain'}));
  fireEvent.blur(screen.getByRole('textbox'), {relatedTarget:screen.getByRole('button', {name:'Outside'})});
  expect(screen.queryByRole('textbox')).toBeNull();
});
