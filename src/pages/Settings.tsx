import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const Settings = () => {
  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your quantum model and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-6">Model Configuration</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Quantum Layers</Label>
              <Slider
                defaultValue={[8]}
                min={4}
                max={16}
                step={1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">Current: 8 layers</p>
            </div>

            <div className="space-y-2">
              <Label>Learning Rate</Label>
              <Input
                type="number"
                defaultValue="0.01"
                step="0.001"
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Batch Size</Label>
              <Input
                type="number"
                defaultValue="32"
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Training Epochs</Label>
              <Input
                type="number"
                defaultValue="500"
                className="bg-input"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-6">Prediction Settings</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Auto-Train Model</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically retrain on new data
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Real-time Predictions</Label>
                <p className="text-xs text-muted-foreground">
                  Enable live market monitoring
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Confidence Threshold</Label>
                <p className="text-xs text-muted-foreground">
                  Minimum confidence to display predictions
                </p>
              </div>
            </div>
            <Slider
              defaultValue={[75]}
              min={50}
              max={95}
              step={5}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground">Current: 75%</p>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified of high-confidence predictions
                </p>
              </div>
              <Switch />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
        <h2 className="text-xl font-bold mb-6">API Configuration</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>API Endpoint</Label>
            <Input
              defaultValue="https://api.quantum-predictor.ai/v1"
              className="bg-input font-mono text-sm"
              readOnly
            />
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                defaultValue="qk_1234567890abcdef"
                className="bg-input font-mono text-sm"
                readOnly
              />
              <Button variant="outline">Regenerate</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className="gradient-quantum shadow-glow hover:shadow-elevated transition-all"
        >
          Save Configuration
        </Button>
      </div>
    </div>
  );
};

export default Settings;
