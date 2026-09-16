import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDivider } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { ManageCategories } from './manage-categories/manage-categories';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatDivider,
    MatSnackBarModule,
    ReactiveFormsModule,
    ManageCategories
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);

  profileForm: FormGroup;
  preferencesForm: FormGroup;
  subscriptionTier = '';

  constructor(private fb: FormBuilder) {
    // Empty until the real profile loads — no fabricated placeholder name/email.
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['']
    });

    this.preferencesForm = this.fb.group({
      currency: ['USD'],
      language: ['English'],
      emailNotifications: [true],
      smsNotifications: [false],
      marketingEmails: [false]
    });
  }

  ngOnInit(): void {
    this.profileService.getProfile().subscribe({
      next: profile => {
        this.profileForm.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email
        });
        this.subscriptionTier = profile.subscriptionTier;
      },
      error: err => {
        const message = err?.error?.detail || 'Failed to load your profile.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  saveProfile() {
    if (this.profileForm.valid) {
      console.log('Profile saved:', this.profileForm.value);
      // Implement toast notification here in future
    }
  }

  savePreferences() {
    if (this.preferencesForm.valid) {
      console.log('Preferences saved:', this.preferencesForm.value);
    }
  }
}
