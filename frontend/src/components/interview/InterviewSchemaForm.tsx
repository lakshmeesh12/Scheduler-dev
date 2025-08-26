import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

interface InterviewSchema {
  rounds: { number: number; name: string }[];
}

interface InterviewSchemaFormProps {
  initialSchema: InterviewSchema;
  onSave: (schema: InterviewSchema) => void;
  onCancel: () => void;
}

export const InterviewSchemaForm = ({ initialSchema, onSave, onCancel }: InterviewSchemaFormProps) => {
  const [rounds, setRounds] = useState(initialSchema.rounds.length > 0 
    ? initialSchema.rounds 
    : [{ number: 1, name: "Screening" }]);
  const [error, setError] = useState("");

  const addRound = () => {
    setRounds([...rounds, { number: rounds.length + 1, name: `Round ${rounds.length + 1}` }]);
  };

  const updateRoundName = (index: number, name: string) => {
    const updatedRounds = rounds.map((round, i) => 
      i === index ? { ...round, name } : round
    );
    setRounds(updatedRounds);
  };

  const removeRound = (index: number) => {
    if (rounds.length > 1) {
      const updatedRounds = rounds
        .filter((_, i) => i !== index)
        .map((round, i) => ({ ...round, number: i + 1 }));
      setRounds(updatedRounds);
    }
  };

  const handleSubmit = () => {
    // Validate round names
    const invalidRound = rounds.find(round => !round.name.trim());
    if (invalidRound) {
      setError("All rounds must have a valid name");
      return;
    }
    
    onSave({ rounds });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="gradient-text">Define Interview Schema</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rounds.map((round, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={round.name}
                onChange={(e) => updateRoundName(index, e.target.value)}
                placeholder={`Round ${round.number} Name`}
                className="flex-grow"
              />
              {rounds.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRound(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button
            onClick={addRound}
            variant="outline"
            className="w-full glass border-gray-200"
          >
            Add Round
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Save Schema
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1 glass border-gray-200"
            >
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};