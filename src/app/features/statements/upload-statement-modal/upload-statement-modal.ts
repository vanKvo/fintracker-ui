import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-upload-statement-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    FormsModule
  ],
  templateUrl: './upload-statement-modal.html',
  styleUrl: './upload-statement-modal.scss'
})
export class UploadStatementModal {
  dialogRef = inject(MatDialogRef<UploadStatementModal>);
  
  accounts = ['Chase Checking', 'Amex Platinum', 'Citi Double Cash'];
  selectedAccount = signal('');
  selectedFile = signal<File | null>(null);

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
    }
  }

  cancel() {
    this.dialogRef.close();
  }

  upload() {
    if (this.selectedAccount() && this.selectedFile()) {
      this.dialogRef.close({
        account: this.selectedAccount(),
        file: this.selectedFile()
      });
    }
  }
}
