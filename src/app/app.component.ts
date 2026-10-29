import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Link, LinksService } from './links.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly api = inject(LinksService);
  readonly url = signal('');
  readonly links = signal<Link[]>([]);
  readonly result = signal<Link | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly listError = signal('');

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    if (this.loading()) return;
    this.loading.set(true);
    this.listError.set('');
    try {
      this.links.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.listError.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async shorten() {
    if (this.saving()) return;
    this.formError.set('');
    this.result.set(null);
    const url = this.url().trim();
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch {
      this.formError.set('Enter a valid URL starting with http:// or https://.');
      return;
    }
    this.saving.set(true);
    try {
      const link = await firstValueFrom(this.api.create(url));
      this.result.set(link);
      this.links.update(links => [...links.filter(item => item.code !== link.code), link]);
      this.url.set('');
    } catch (error) {
      this.formError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Cannot reach the backend at localhost:3000. Please try again.';
      if (typeof error.error?.error === 'string') return error.error.error;
    }
    return 'Something went wrong. Please try again.';
  }
}
