import { Component } from '@angular/core';
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
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

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
    ReactiveFormsModule
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  profileForm: FormGroup;
  preferencesForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.profileForm = this.fb.group({
      firstName: ['Alex', Validators.required],
      lastName: ['Morgan', Validators.required],
      email: ['alex.morgan@example.com', [Validators.required, Validators.email]],
      phone: ['+1 (555) 123-4567']
    });

    this.preferencesForm = this.fb.group({
      currency: ['USD'],
      language: ['English'],
      emailNotifications: [true],
      smsNotifications: [false],
      marketingEmails: [false]
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
