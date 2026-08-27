"""What a person is, kept apart from what they may do.

`role` is a label an administrator sets. `is_staff` is the gate every staff-only
endpoint in this project actually reads. Wiring the first into the second in
some places and not others is exactly how `correct_answer` stayed readable in
three endpoints after being fixed in the fourth, so these tests hold them apart
and will fail the day somebody joins them -- which is the day to think about it
rather than the day after.

The other half is that a role has to be worth something: a teacher nobody
appointed is not a teacher. Handing one out is a superuser action, like the two
flags beside it.
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import User

VALID_PW = 'Str0ngPassw0rd!x'


def _register_payload(**over):
    data = {
        'first_name': 'Aziz', 'last_name': 'Karimov',
        'email': 'aziz@example.com', 'date_of_birth': '2010-01-01',
        'password': VALID_PW, 'password2': VALID_PW,
    }
    data.update(over)
    return data


class RegistrationRoleTests(TestCase):
    """Nobody appoints themselves on the way in."""

    def setUp(self):
        self.client = APIClient()

    def test_registering_makes_a_student(self):
        r = self.client.post('/api/v1/auth/register/', _register_payload(), format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['user']['role'], User.Role.STUDENT)

    def test_asking_to_be_an_administrator_is_ignored(self):
        """The field is not writable, so this is already true -- and it is the
        test that will fail if somebody adds `role` to the register serializer
        because a form needed it."""
        r = self.client.post(
            '/api/v1/auth/register/',
            _register_payload(role='admin', is_staff=True),
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='aziz@example.com')
        self.assertEqual(user.role, User.Role.STUDENT)
        self.assertFalse(user.is_staff)

    def test_a_person_can_see_their_own_role_and_cannot_change_it(self):
        self.client.post('/api/v1/auth/register/', _register_payload(), format='json')
        user = User.objects.get(email='aziz@example.com')
        self.client.force_authenticate(user=user)

        self.assertEqual(self.client.get('/api/v1/auth/me/').data['role'], User.Role.STUDENT)

        self.client.patch('/api/v1/auth/me/', {'role': 'teacher'}, format='json')
        user.refresh_from_db()
        self.assertEqual(user.role, User.Role.STUDENT)


class RoleGrantsNothingTests(TestCase):
    """A label is not a permission, and this project has one gate already."""

    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user(
            'teacher', email='teacher@example.com', password=VALID_PW, role=User.Role.TEACHER,
        )
        self.labelled_admin = User.objects.create_user(
            'labelled', email='labelled@example.com', password=VALID_PW, role=User.Role.ADMIN,
        )

    def test_a_teacher_reaches_nothing_a_student_does_not(self):
        self.client.force_authenticate(user=self.teacher)
        r = self.client.get('/api/v1/admin-panel/users/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_label_administrator_is_not_administrator_access(self):
        """If this one ever fails, somebody has made a mislabelled pupil into an
        administrator of a site used by children."""
        self.assertFalse(self.labelled_admin.is_staff)
        self.client.force_authenticate(user=self.labelled_admin)
        r = self.client.get('/api/v1/admin-panel/users/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class RoleAssignmentTests(TestCase):
    """Handing out a role is a superuser action, like is_staff and is_active
    beside it. Two places decide that -- the serializer and the tuple in the
    view that says which fields are privileged -- and adding it to only one of
    them would let any member of staff appoint teachers."""

    def setUp(self):
        self.client = APIClient()
        self.pupil = User.objects.create_user('pupil', email='pupil@example.com', password=VALID_PW)
        self.staff = User.objects.create_user(
            'staff', email='staff@example.com', password=VALID_PW, is_staff=True,
        )
        self.owner = User.objects.create_superuser(
            'owner', email='owner@example.com', password=VALID_PW,
        )

    def _set_role(self, actor, role):
        self.client.force_authenticate(user=actor)
        return self.client.patch(
            f'/api/v1/admin-panel/users/{self.pupil.id}/', {'role': role}, format='json',
        )

    def test_a_member_of_staff_cannot_appoint_a_teacher(self):
        r = self._set_role(self.staff, User.Role.TEACHER)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.pupil.refresh_from_db()
        self.assertEqual(self.pupil.role, User.Role.STUDENT)

    def test_the_owner_can(self):
        r = self._set_role(self.owner, User.Role.TEACHER)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pupil.refresh_from_db()
        self.assertEqual(self.pupil.role, User.Role.TEACHER)

    def test_a_role_that_does_not_exist_is_refused(self):
        r = self._set_role(self.owner, 'headmaster')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.pupil.refresh_from_db()
        self.assertEqual(self.pupil.role, User.Role.STUDENT)

    def test_appointing_an_administrator_does_not_hand_out_staff_access(self):
        """The two are set separately and deliberately. A label typed into a
        panel must not be a way into the panel."""
        self._set_role(self.owner, User.Role.ADMIN)
        self.pupil.refresh_from_db()
        self.assertEqual(self.pupil.role, User.Role.ADMIN)
        self.assertFalse(self.pupil.is_staff)

    def test_a_profile_edit_does_not_carry_a_role_with_it(self):
        """`role` is read-only on the profile serializer, so a staff member
        editing a name cannot slip a promotion in beside it."""
        self.client.force_authenticate(user=self.staff)
        r = self.client.patch(
            f'/api/v1/admin-panel/users/{self.pupil.id}/',
            {'first_name': 'Renamed'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pupil.refresh_from_db()
        self.assertEqual(self.pupil.first_name, 'Renamed')
        self.assertEqual(self.pupil.role, User.Role.STUDENT)
