import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="container grid place-items-center py-24 text-center">
      <div className="font-chinese text-8xl text-primary">迷</div>
      <h1 className="mt-6 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        The page you're looking for doesn't exist. Try the diagnostic — that's the best way in.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
