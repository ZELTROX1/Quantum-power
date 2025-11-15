from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import io
import os
from typing import Optional
from datetime import datetime

app = FastAPI(title="ML Model API")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload-csv/")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        # Read CSV content
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Save the file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(UPLOAD_DIR, f"data_{timestamp}.csv")
        df.to_csv(file_path, index=False)
        
        return JSONResponse(content={
            "message": "File successfully uploaded",
            "filename": file.filename,
            "rows": len(df),
            "columns": list(df.columns)
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "ML Model API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
