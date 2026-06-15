import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";

import { User } from "./User";

@Entity()
export class Walkthrough {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column()
  origin!: string;

  @Column()
  pathPattern!: string;

  @Column("jsonb")
  steps!: unknown[];

  @ManyToOne(() => User, (user) => user.walkthroughs)
  owner!: User;
}
