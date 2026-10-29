import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  const endpoint = 'http://localhost:3000/api/links';
  const link = { code: 'Ab123x', url: 'https://example.com/', shortUrl: 'http://localhost:3000/Ab123x', hits: 0, createdAt: '2026-10-29T00:00:00.000Z' };
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads links and renders Snip', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne(endpoint).flush([link]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Snip');
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain(link.code);
  });

  it('rejects invalid URLs without sending a request', async () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    for (const url of ['', 'example.com', 'ftp://example.com', 'javascript:alert(1)']) {
      component.url.set(url);
      await component.shorten();
      expect(component.formError()).toContain('http:// or https://');
    }
    http.expectNone(endpoint);
  });

  it('creates a link and updates the result and list', async () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    component.url.set('  https://example.com/  ');
    const pending = component.shorten();
    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ url: 'https://example.com/' });
    request.flush(link);
    await pending;
    expect(component.result()).toEqual(link);
    expect(component.links()).toEqual([link]);
    expect(component.url()).toBe('');
    expect(component.saving()).toBeFalse();
  });

  it('shows API errors inline and preserves the input', async () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    component.url.set(link.url);
    const pending = component.shorten();
    http.expectOne(endpoint).flush({ error: 'Invalid URL.' }, { status: 400, statusText: 'Bad Request' });
    await pending;
    expect(component.formError()).toBe('Invalid URL.');
    expect(component.url()).toBe(link.url);
    expect(component.saving()).toBeFalse();
  });

  it('preserves existing links on a network failure', async () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    component.links.set([link]);
    const pending = component.refresh();
    http.expectOne(endpoint).error(new ProgressEvent('error'));
    await pending;
    expect(component.listError()).toContain('Cannot reach the backend');
    expect(component.links()).toEqual([link]);
    expect(component.loading()).toBeFalse();
  });
});