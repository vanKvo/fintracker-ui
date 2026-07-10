import { Component, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { COMMA, ENTER } from '@angular/cdk/keycodes';

export interface AddTagDialogData {
  merchant: string;
  existingTags: string[];
}

// Mirrors the server-side constraints in AppendTagsRequest / TransactionServiceImpl
// (REQ-2.2 "Tag Array Appending") so bad input is caught before a round trip.
const TAG_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS = 10;

@Component({
  selector: 'app-add-tag-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatFormFieldModule
  ],
  templateUrl: './add-tag-dialog.html',
  styleUrl: './add-tag-dialog.scss'
})
export class AddTagDialog {
  readonly separatorKeysCodes = [ENTER, COMMA];
  readonly maxTags = MAX_TAGS;

  merchant: string;
  existingTags: string[];

  newTags = signal<string[]>([]);
  errorMessage = signal<string | null>(null);

  remainingSlots = computed(() => this.maxTags - this.existingTags.length - this.newTags().length);

  constructor(
    private dialogRef: MatDialogRef<AddTagDialog>,
    @Inject(MAT_DIALOG_DATA) data: AddTagDialogData
  ) {
    this.merchant = data.merchant;
    this.existingTags = data.existingTags.map(t => t.toLowerCase());
  }

  addTag(event: MatChipInputEvent): void {
    const raw = (event.value || '').trim();
    event.chipInput?.clear();
    if (!raw) return;

    const candidate = raw.toLowerCase();

    if (!TAG_PATTERN.test(candidate)) {
      this.errorMessage.set(`"${raw}" may only contain letters, numbers, hyphens, and underscores.`);
      return;
    }
    if (candidate.length > MAX_TAG_LENGTH) {
      this.errorMessage.set(`Tags must be ${MAX_TAG_LENGTH} characters or fewer.`);
      return;
    }
    if (this.existingTags.includes(candidate) || this.newTags().includes(candidate)) {
      this.errorMessage.set(`"${raw}" is already on this transaction.`);
      return;
    }
    if (this.remainingSlots() <= 0) {
      this.errorMessage.set(`A transaction can have at most ${this.maxTags} tags.`);
      return;
    }

    this.errorMessage.set(null);
    this.newTags.update(tags => [...tags, candidate]);
  }

  removeTag(tag: string): void {
    this.newTags.update(tags => tags.filter(t => t !== tag));
    this.errorMessage.set(null);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (this.newTags().length === 0) return;
    this.dialogRef.close(this.newTags());
  }
}
