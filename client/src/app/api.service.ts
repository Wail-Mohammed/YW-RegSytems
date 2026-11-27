import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  async get<T>(path: string, filters: Record<string, string> = {}): Promise<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value !== '') params = params.set(key, value);
    return this.execute(() => firstValueFrom(this.http.get<T>('/api' + path, { params })));
  }
  async write<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
    return this.execute(() => firstValueFrom(this.http.request<T>(method, '/api' + path, { body })));
  }
  private async execute<T>(request: () => Promise<T>): Promise<T> {
    try { return await request(); }
    catch (error) {
      if (error instanceof HttpErrorResponse) {
        const payload = error.error as { error?: unknown } | null;
        const message = payload && typeof payload.error === 'string' ? payload.error : error.status === 0 ? 'Cannot reach the server. Check the local app and MySQL connection.' : 'The request could not be completed.';
        throw new Error(message);
      }
      throw error;
    }
  }
}
