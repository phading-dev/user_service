import path = require("path");
import { createWriteStream } from "fs";
import { Writable } from "stream";

export class FileFake {
  public constructor(private filename: string) {}
  public publicUrl(): string {
    return `${this.filename}`;
  }
  public createWriteStream(): Writable {
    return createWriteStream(path.join("test_data", this.filename));
  }
}

export class BucketFake {
  public constructor() {}

  public file(filename: string): FileFake {
    return new FileFake(filename);
  }
}

export class StorageFake {
  public bucket(bucketName: string): BucketFake {
    return new BucketFake();
  }
}
