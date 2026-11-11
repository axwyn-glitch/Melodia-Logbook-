-- OPTIONAL sample data. Run once, after schema.sql. Skip it on a real live site.
INSERT INTO instructors (name,email,specialty) VALUES
 ('Tunde Bello','tunde@melodia.dev','Full Stack'),
 ('Amaka Obi','amaka@melodia.dev','JavaScript'),
 ('Sade Ibrahim','sade@melodia.dev','Frontend');
INSERT INTO courses (title,instructor_id,duration,fee) VALUES
 ('Full Stack Web Development',1,'6 months',250000),
 ('JavaScript Programming',2,'3 months',120000),
 ('Frontend Web Development',3,'4 months',150000);
INSERT INTO students (name,email,phone) VALUES
 ('Mary James','mary@example.com','0803 000 0001'),
 ('Daniel Eze','daniel@example.com','0803 000 0002'),
 ('Grace Adebayo','grace@example.com','0803 000 0003'),
 ('John Okafor','john@example.com','0803 000 0004');
INSERT INTO enrollments (student_id,course_id,status,progress) VALUES
 (1,1,'Enrolled',0),(2,2,'Completed',100),(3,3,'In Progress',45),(4,1,'In Progress',30);
