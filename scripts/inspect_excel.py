import pandas as pd
import sys

try:
    # Load the Excel file
    file_path = 'references/Tabel Kriteria Evaluasi AKIP MA RI.xlsx'
    df = pd.read_excel(file_path, header=None)
    
    # Print the first 20 rows
    print("First 20 rows of the Excel file:")
    print(df.head(20).to_string())
    
    # Also verify the other file
    file_path_skor = 'references/Tabel Skor Penilaian Evaluasi AKIP.xlsx'
    df_skor = pd.read_excel(file_path_skor, header=None)
    print("\nFirst 20 rows of Skor file:")
    print(df_skor.head(20).to_string())

except Exception as e:
    print(f"Error: {e}")
